use super::{load_installation, node_command};
use std::io::Write;
use std::process::{Child, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc, Mutex,
};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use tauri::{menu::MenuItem, AppHandle, Manager, Wry};

pub struct SyncHost {
    stop: mpsc::Sender<()>,
    thread: Mutex<Option<JoinHandle<()>>>,
    exiting: AtomicBool,
    finished: Arc<AtomicBool>,
    stopping: Arc<AtomicBool>,
}

fn shutdown(child: &mut Child) {
    // The common foreground CLI treats this channel's close or data as a stop
    // request and cancels/reaps its Git child before releasing the clone lease.
    if let Some(mut input) = child.stdin.take() {
        let _ = input.write_all(b"stop\n");
    }
    let deadline = Instant::now() + Duration::from_secs(10);
    while matches!(child.try_wait(), Ok(None)) && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(25));
    }
    if matches!(child.try_wait(), Ok(None)) {
        let _ = child.kill();
    }
    let _ = child.wait();
}

// A file is only a bounded-lifetime stdout transport, not another status store.
// Avoid pipe-reader threads that could keep shutdown waiting on a stuck child.
fn tray_query(
    home: &std::path::Path,
    root: &std::path::Path,
    stopping: &AtomicBool,
) -> Result<serde_json::Value, String> {
    let installation = load_installation(home)?;
    let capture = root.join(format!(
        ".git/infohub-sync/tray-status-{}.tmp",
        std::process::id()
    ));
    let result = (|| {
        let output = std::fs::File::create(&capture).map_err(|e| e.to_string())?;
        let mut child = node_command(&installation)?
            .arg(&installation.runtime.cli)
            .arg("--root")
            .arg(root)
            .args(["sync", "status"])
            .stdout(output)
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            match child.try_wait().map_err(|e| e.to_string())? {
                Some(exit) if exit.success() => {
                    return serde_json::from_slice(
                        &std::fs::read(&capture).map_err(|e| e.to_string())?,
                    )
                    .map_err(|e| e.to_string())
                }
                Some(exit) => return Err(format!("状态查询退出：{exit}")),
                None => {}
            }
            if stopping.load(Ordering::Acquire) || Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                return Err("状态查询取消或超时".into());
            }
            std::thread::sleep(Duration::from_millis(25));
        }
    })();
    let _ = std::fs::remove_file(capture);
    result
}

fn retry_delay(failures: u32) -> Duration {
    Duration::from_secs(2u64.saturating_pow(failures.min(6)).min(60))
}

fn status_text(value: &serde_json::Value) -> String {
    if let Some(pending) = value["pending"]
        .as_object()
        .and_then(|p| p.values().next())
        .and_then(|v| v.as_str())
    {
        return format!("同步：{}", pending.chars().take(65).collect::<String>());
    }
    if value["running"].as_bool() == Some(true) {
        "同步正常".into()
    } else {
        "同步未运行".into()
    }
}

impl SyncHost {
    pub fn start(app: AppHandle, status: MenuItem<Wry>) -> Self {
        let (stop, receiver) = mpsc::channel();
        let finished = Arc::new(AtomicBool::new(false));
        let thread_finished = finished.clone();
        let stopping = Arc::new(AtomicBool::new(false));
        let worker_stopping = stopping.clone();
        let thread = std::thread::spawn(move || {
            let home = match app.path().home_dir() {
                Ok(home) => home,
                Err(error) => {
                    let _ = status.set_text(format!("同步：{error}"));
                    return;
                }
            };
            let mut failures = 0;
            loop {
                if receiver.try_recv().is_ok() {
                    break;
                }
                let result = (|| {
                    let installation = load_installation(&home)?;
                    let root = std::path::PathBuf::from(
                        installation
                            .root
                            .as_deref()
                            .ok_or("请运行 InfoHub 安装器")?,
                    );
                    if !root.is_dir() || !root.join(".git").is_dir() {
                        return Err("InfoHub 副本不存在，请重跑安装器".into());
                    }
                    let log_dir = root.join(".git/infohub-sync");
                    std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
                    let log_path = log_dir.join("workbench.log");
                    let log = std::fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(&log_path)
                        .map_err(|e| e.to_string())?;
                    let mut command = node_command(&installation)?;
                    let child = command
                        .arg(&installation.runtime.cli)
                        .arg("--root")
                        .arg(&root)
                        .args(["sync", "run", "--parent-stdio"])
                        .env("INFOHUB_SYNC_MANAGER", "workbench")
                        .env("INFOHUB_SYNC_LOG", &log_path)
                        .stdin(Stdio::piped())
                        .stdout(log.try_clone().map_err(|e| e.to_string())?)
                        .stderr(log)
                        .spawn()
                        .map_err(|e| e.to_string())?;
                    Ok::<_, String>((child, root))
                })();
                let (mut child, root) = match result {
                    Ok(value) => value,
                    Err(error) => {
                        failures += 1;
                        let _ = status.set_text(format!(
                            "同步：{}",
                            error.chars().take(65).collect::<String>()
                        ));
                        if receiver.recv_timeout(retry_delay(failures)).is_ok() {
                            break;
                        }
                        continue;
                    }
                };
                let started = Instant::now();
                let mut next_status = Instant::now();
                let mut quitting = false;
                loop {
                    if receiver.try_recv().is_ok() {
                        quitting = true;
                        shutdown(&mut child);
                        break;
                    }
                    match child.try_wait() {
                        Ok(Some(exit)) => {
                            log::warn!("InfoHub sync exited: {exit}");
                            break;
                        }
                        Err(error) => {
                            log::error!("InfoHub sync wait: {error}");
                            shutdown(&mut child);
                            break;
                        }
                        Ok(None) => {}
                    }
                    if Instant::now() >= next_status {
                        let text = match tray_query(&home, &root, &worker_stopping) {
                            Ok(value) => status_text(&value),
                            Err(error) => {
                                format!("同步：{}", error.chars().take(65).collect::<String>())
                            }
                        };
                        let _ = status.set_text(text);
                        next_status = Instant::now() + Duration::from_secs(5);
                    }
                    if receiver.recv_timeout(Duration::from_millis(250)).is_ok() {
                        quitting = true;
                        shutdown(&mut child);
                        break;
                    }
                }
                if quitting {
                    break;
                }
                if started.elapsed() >= Duration::from_secs(60) {
                    failures = 0;
                }
                failures += 1;
                let delay = retry_delay(failures);
                let _ = status.set_text(format!(
                    "同步进程退出，{} 秒后重试；详情见同步日志",
                    delay.as_secs()
                ));
                if receiver.recv_timeout(delay).is_ok() {
                    break;
                }
            }
            thread_finished.store(true, Ordering::Release);
        });
        Self {
            stop,
            thread: Mutex::new(Some(thread)),
            exiting: AtomicBool::new(false),
            finished,
            stopping,
        }
    }

    // Keep the event loop alive while the worker drains the child. Menu updates
    // dispatch through that loop, so joining it synchronously here would deadlock.
    pub fn request_exit(&self, app: AppHandle, code: i32) -> bool {
        if self.finished.load(Ordering::Acquire) {
            return false;
        }
        if !self.exiting.swap(true, Ordering::AcqRel) {
            self.stopping.store(true, Ordering::Release);
            let _ = self.stop.send(());
            if let Some(thread) = self.thread.lock().unwrap().take() {
                let finished = self.finished.clone();
                std::thread::spawn(move || {
                    let _ = thread.join();
                    finished.store(true, Ordering::Release);
                    app.exit(code);
                });
            }
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stuck_status_query_can_be_cancelled_without_blocking_shutdown() {
        let home = tempfile::tempdir().unwrap();
        let root = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(home.path().join(".config/infohub")).unwrap();
        std::fs::create_dir_all(root.path().join(".git/infohub-sync")).unwrap();
        let cli = home.path().join("stuck.mjs");
        std::fs::write(&cli, "setInterval(()=>{}, 1000)").unwrap();
        let node = std::process::Command::new("node")
            .args(["-p", "process.execPath"])
            .output()
            .unwrap();
        let config = serde_json::json!({"root": root.path(), "runtime": {"node": String::from_utf8(node.stdout).unwrap().trim(), "cli": cli}});
        std::fs::write(
            home.path().join(".config/infohub/config.json"),
            serde_json::to_vec(&config).unwrap(),
        )
        .unwrap();
        let stopping = Arc::new(AtomicBool::new(false));
        let flag = stopping.clone();
        let timer = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(100));
            flag.store(true, Ordering::Release);
        });
        let start = Instant::now();
        assert!(tray_query(home.path(), root.path(), &stopping).is_err());
        timer.join().unwrap();
        assert!(start.elapsed() < Duration::from_secs(2));
        assert_eq!(
            std::fs::read_dir(root.path().join(".git/infohub-sync"))
                .unwrap()
                .count(),
            0
        );
    }

    #[test]
    fn retries_are_capped_and_status_comes_from_cli_snapshot() {
        assert_eq!(retry_delay(1).as_secs(), 2);
        assert_eq!(retry_delay(2).as_secs(), 4);
        assert_eq!(retry_delay(20).as_secs(), 60);
        assert_eq!(
            status_text(&serde_json::json!({"running":true,"pending":{}})),
            "同步正常"
        );
        assert_eq!(
            status_text(&serde_json::json!({"running":true,"pending":{"fetch":"offline"}})),
            "同步：offline"
        );
    }
}
