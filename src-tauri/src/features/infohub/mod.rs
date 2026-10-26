pub mod host;
use crate::shared::storage;
use serde::Deserialize;
use serde_json::Value;
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[derive(Deserialize)]
struct Installation {
    root: Option<String>,
    runtime: Runtime,
}

#[derive(Deserialize)]
struct Runtime {
    node: String,
    cli: String,
}

fn node_path(node: &Path) -> Result<std::ffi::OsString, String> {
    let parent = node
        .parent()
        .filter(|_| node.is_absolute())
        .ok_or("InfoHub Node entry must be absolute; rerun the installer")?;
    let mut dirs = vec![parent.to_path_buf()];
    #[cfg(windows)]
    {
        let root = std::path::PathBuf::from(
            std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()),
        );
        dirs.push(root.join("System32"));
        dirs.push(root);
    }
    #[cfg(not(windows))]
    dirs.extend(["/usr/bin", "/bin", "/usr/sbin", "/sbin"].map(std::path::PathBuf::from));
    std::env::join_paths(dirs).map_err(|e| e.to_string())
}

// Ontology and synchronization semantics belong to the installed InfoHub CLI.
// Arguments remain separate OS arguments, including roots containing shell syntax.
fn load_installation(home: &Path) -> Result<Installation, String> {
    let config = home.join(".config/infohub/config.json");
    serde_json::from_slice(&std::fs::read(config).map_err(|e| {
        format!("InfoHub installation: {e}; run node scripts/install.mjs --root <InfoHub>")
    })?)
    .map_err(|e| {
        format!("InfoHub installation: {e}; rerun node scripts/install.mjs --root <InfoHub>")
    })
}

fn node_command(installation: &Installation) -> Result<Command, String> {
    let mut command = Command::new(&installation.runtime.node);
    // Only boot Node here. The CLI owns Git and builds its own minimal PATH.
    command.env("PATH", node_path(Path::new(&installation.runtime.node))?);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    Ok(command)
}

fn query(home: &Path, root: &Path, args: &[&str]) -> Result<Value, String> {
    let installation = load_installation(home)?;
    let mut command = node_command(&installation)?;
    let output = command
        .arg(&installation.runtime.cli)
        .arg("--root")
        .arg(root)
        .args(args)
        .output()
        .map_err(|e| format!("Cannot run InfoHub CLI: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "InfoHub CLI: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    serde_json::from_slice(&output.stdout).map_err(|e| format!("Invalid InfoHub JSON: {e}"))
}

#[tauri::command]
pub async fn infohub_overview(app: AppHandle, vault_id: String) -> Result<Value, String> {
    let root = storage::vault_path(&app, &vault_id)?;
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || query(&home, &root, &["overview"]))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn infohub_sync_status(app: AppHandle, vault_id: String) -> Result<Value, String> {
    let root = storage::vault_path(&app, &vault_id)?;
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || query(&home, &root, &["sync", "status"]))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_arguments_survive_spaces_chinese_and_shell_metacharacters() {
        let home = tempfile::tempdir().unwrap();
        let config_dir = home.path().join(".config/infohub");
        std::fs::create_dir_all(&config_dir).unwrap();
        let cli = home.path().join("接口 & $ test.mjs");
        std::fs::write(&cli, "console.log(JSON.stringify(process.argv.slice(2)))").unwrap();
        let node = Command::new("node")
            .args(["-p", "process.execPath"])
            .output()
            .unwrap();
        assert!(node.status.success());
        let config = serde_json::json!({"runtime": {
            "node": String::from_utf8(node.stdout).unwrap().trim(), "cli": cli
        }});
        std::fs::write(config_dir.join("config.json"), config.to_string()).unwrap();
        let root = home.path().join("中文 文档 & $ literal");
        let result = query(home.path(), &root, &["sync", "status"]).unwrap();
        assert_eq!(
            result,
            serde_json::json!(["--root", root, "sync", "status"])
        );
    }

    #[test]
    fn missing_installation_is_an_error_not_an_empty_snapshot() {
        let home = tempfile::tempdir().unwrap();
        assert!(query(home.path(), home.path(), &["overview"]).is_err());
    }

    #[test]
    fn gui_child_path_contains_only_node_and_os_directories() {
        let home = tempfile::tempdir().unwrap();
        let node = home.path().join("shims/node");
        let dirs: Vec<_> = std::env::split_paths(&node_path(&node).unwrap()).collect();
        assert_eq!(dirs[0], node.parent().unwrap());
        #[cfg(not(windows))]
        assert_eq!(
            &dirs[1..],
            ["/usr/bin", "/bin", "/usr/sbin", "/sbin"].map(std::path::PathBuf::from)
        );
        #[cfg(windows)]
        assert_eq!(dirs.len(), 3);
        assert!(node_path(Path::new("node")).is_err());
    }
}
