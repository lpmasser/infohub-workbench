use super::exit;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    AppHandle, Manager, Wry,
};
use tauri_plugin_updater::{Update, UpdaterExt};

pub const EXIT_TO_UPDATE: i32 = 73;
const CHECK_INTERVAL: Duration = Duration::from_secs(30 * 60);

struct Pending {
    update: Update,
    bytes: Vec<u8>,
}

pub struct Updates {
    pending: Mutex<Option<Pending>>,
    applying: AtomicBool,
    suppress_auto: AtomicBool,
    menu: Menu<Wry>,
    restart: MenuItem<Wry>,
    sync_status: MenuItem<Wry>,
}

impl Updates {
    pub fn new(menu: Menu<Wry>, restart: MenuItem<Wry>, sync_status: MenuItem<Wry>) -> Self {
        Self {
            pending: Mutex::new(None),
            applying: AtomicBool::new(false),
            suppress_auto: AtomicBool::new(false),
            menu,
            restart,
            sync_status,
        }
    }
}

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            if let Err(error) = check(&app).await {
                log::warn!("Update check/download rejected: {error}");
            }
            try_automatic(&app);
            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}

async fn check(app: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let state = app.state::<Updates>();
    if state.applying.load(Ordering::Acquire) {
        return Ok(());
    }
    log::info!(
        "Checking for updates; current={}",
        app.package_info().version
    );
    let Some(update) = app
        .updater_builder()
        // Our save/close and sync drain are complete before install. Preserve
        // Tauri resources if Windows fails to launch its installer; process
        // exit releases them after a successful launch.
        .on_before_exit(|| {})
        .timeout(Duration::from_secs(120))
        .build()?
        .check()
        .await?
    else {
        return Ok(());
    };
    if state
        .pending
        .lock()
        .unwrap()
        .as_ref()
        .is_some_and(|p| p.update.version == update.version)
    {
        state.suppress_auto.store(false, Ordering::Release);
        return Ok(());
    }
    // The official plugin verifies the signature before returning these bytes.
    let bytes = update.download(|_, _| {}, || {}).await?;
    if exit::is_updating(app) || state.applying.load(Ordering::Acquire) {
        return Ok(());
    }
    log::info!(
        "Update downloaded and signature verified: {}",
        update.version
    );
    let first = state
        .pending
        .lock()
        .unwrap()
        .replace(Pending { update, bytes })
        .is_none();
    state.suppress_auto.store(false, Ordering::Release);
    if first {
        state.menu.insert(&state.restart, 2)?;
    }
    Ok(())
}

fn automatic_allowed(visible: bool, documents: bool, main_ready: bool, blocked: bool) -> bool {
    !visible && !documents && main_ready && !blocked
}

pub fn automatic_eligible(app: &AppHandle) -> bool {
    let windows = app.webview_windows();
    let main = windows.get("main");
    let exit = app.state::<exit::ExitState>();
    automatic_allowed(
        main.is_some_and(|window| window.is_visible().unwrap_or(true)),
        windows.keys().any(|label| label.starts_with("document-")),
        main.is_none() || exit.ready.load(Ordering::Acquire),
        main.is_some() && exit.update_blocked.load(Ordering::Acquire),
    )
}

pub fn is_applying(app: &AppHandle) -> bool {
    app.try_state::<Updates>()
        .is_some_and(|state| state.applying.load(Ordering::Acquire))
}

pub fn try_automatic(app: &AppHandle) {
    let Some(state) = app.try_state::<Updates>() else {
        return;
    };
    if !state.suppress_auto.load(Ordering::Acquire) && automatic_eligible(app) {
        request(app, true);
    }
}

pub fn request(app: &AppHandle, automatic: bool) {
    let state = app.state::<Updates>();
    if !state.applying.load(Ordering::Acquire) && state.pending.lock().unwrap().is_some() {
        if !automatic || automatic_eligible(app) {
            exit::request_update(app, automatic);
        }
    }
}

// Called only after the existing save/close flow and sync-child shutdown finish.
pub fn install(app: &AppHandle) {
    let state = app.state::<Updates>();
    let reason = exit::reason(app);
    if exit::has_documents(app)
        || !reason
            .is_some_and(|r| r.updating && r.completed && (!r.automatic || automatic_eligible(app)))
    {
        exit::cancel(app);
        resume_sync(app);
        return;
    }
    if state.applying.swap(true, Ordering::AcqRel) {
        return;
    }
    let Some(pending) = state.pending.lock().unwrap().take() else {
        state.applying.store(false, Ordering::Release);
        exit::cancel(app);
        resume_sync(app);
        return;
    };
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        log::info!("Installing verified update: {}", pending.update.version);
        match pending.update.install(&pending.bytes) {
            Ok(()) => {
                log::info!(
                    "Update installed: {}; restarting in background",
                    pending.update.version
                );
                app.request_restart();
            }
            Err(error) => {
                log::error!("Update installation failed; current process retained: {error}");
                let state = app.state::<Updates>();
                *state.pending.lock().unwrap() = Some(pending);
                state.suppress_auto.store(true, Ordering::Release);
                state.applying.store(false, Ordering::Release);
                exit::cancel(&app);
                resume_sync(&app);
            }
        }
    });
}

fn resume_sync(app: &AppHandle) {
    let status = app.state::<Updates>().sync_status.clone();
    *app.state::<super::ManagedSync>().lock().unwrap() =
        crate::features::infohub::host::SyncHost::start(app.clone(), status);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn application_version_comes_from_package_metadata() {
        let package: serde_json::Value =
            serde_json::from_str(include_str!("../../../package.json")).unwrap();
        let context = super::super::app_context();
        assert_eq!(
            context.package_info().version.to_string(),
            package["version"].as_str().unwrap()
        );
    }

    #[test]
    fn background_install_requires_every_safety_condition() {
        assert!(automatic_allowed(false, false, true, false));
        for conditions in [
            (true, false, true, false),
            (false, true, true, false),
            (false, false, false, false),
            (false, false, true, true),
        ] {
            assert!(!automatic_allowed(
                conditions.0,
                conditions.1,
                conditions.2,
                conditions.3
            ));
        }
    }
}
