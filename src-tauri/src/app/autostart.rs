use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

fn legacy_command(app: &AppHandle) -> Result<bool, String> {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let home = app.path().home_dir().map_err(|e| e.to_string())?;
        #[cfg(target_os = "macos")]
        let file = home.join("Library/LaunchAgents/InfoHub Workbench.plist");
        #[cfg(target_os = "linux")]
        let file = home.join(".config/autostart/InfoHub Workbench.desktop");
        match std::fs::read_to_string(file) {
            Ok(text) => {
                #[cfg(target_os = "linux")]
                if app.env().appimage.is_some() && text.contains("/usr/bin/infohub-workbench ") {
                    return Ok(true);
                }
                Ok(has_legacy_binary(&text))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let _ = app;
        let output = std::process::Command::new("reg.exe")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "InfoHub Workbench",
            ])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(output.status.success() && has_legacy_binary(&String::from_utf8_lossy(&output.stdout)))
    }
}

fn has_legacy_binary(text: &str) -> bool {
    text.contains("/Contents/MacOS/otterly</string>")
        || text.contains("/otterly --background")
        || text.contains("otterly.exe")
}

pub fn ensure(app: &AppHandle) -> Result<(), String> {
    let autostart = app.autolaunch();
    let enabled = autostart.is_enabled().map_err(|e| e.to_string())?;
    // Migration only: the official plugin owns the same product-name entry.
    // Never refresh an already-enabled registration during normal launches.
    if legacy_command(app)? {
        autostart.disable().map_err(|e| e.to_string())?;
        autostart.enable().map_err(|e| e.to_string())?;
    } else if !enabled {
        autostart.enable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::has_legacy_binary;
    #[test]
    fn migration_recognizes_only_the_old_executable() {
        assert!(has_legacy_binary(
            "<string>/Applications/InfoHub Workbench.app/Contents/MacOS/otterly</string>"
        ));
        assert!(has_legacy_binary("Exec=/usr/bin/otterly --background"));
        assert!(has_legacy_binary(
            r"C:\Users\User\InfoHub Workbench\otterly.exe --background"
        ));
        assert!(!has_legacy_binary(
            "<string>/Applications/InfoHub Workbench.app/Contents/MacOS/infohub-workbench</string>"
        ));
    }
}

pub fn arguments() -> Vec<&'static str> {
    #[cfg(target_os = "linux")]
    {
        vec!["--appimage-extract-and-run", "--background"]
    }
    #[cfg(not(target_os = "linux"))]
    {
        vec!["--background"]
    }
}
