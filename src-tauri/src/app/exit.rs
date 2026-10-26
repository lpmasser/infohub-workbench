use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering},
    Mutex,
};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

#[derive(Clone, Copy, Default, serde::Serialize)]
pub struct ExitRequest {
    pub id: u32,
    pub updating: bool,
    pub automatic: bool,
    #[serde(skip)]
    pub completed: bool,
}

pub struct ExitState {
    pub ready: AtomicBool,
    pub update_blocked: AtomicBool,
    requested: Mutex<Option<ExitRequest>>,
    next_id: AtomicU32,
    hidden_for_update: AtomicBool,
}
impl Default for ExitState {
    fn default() -> Self {
        Self {
            ready: AtomicBool::new(false),
            update_blocked: AtomicBool::new(true),
            requested: Mutex::new(None),
            next_id: AtomicU32::new(1),
            hidden_for_update: AtomicBool::new(false),
        }
    }
}

impl ExitState {
    fn complete(&self, id: u32) -> Option<ExitRequest> {
        let mut requested = self.requested.lock().unwrap();
        let request = requested.as_mut().filter(|request| request.id == id)?;
        request.completed = true;
        Some(*request)
    }

    fn cancel(&self, id: Option<u32>) -> bool {
        let mut requested = self.requested.lock().unwrap();
        if id.is_some_and(|id| !requested.is_some_and(|request| request.id == id)) {
            return false;
        }
        *requested = None;
        true
    }
}

pub fn reason(app: &AppHandle) -> Option<ExitRequest> {
    *app.state::<ExitState>().requested.lock().unwrap()
}
pub fn is_updating(app: &AppHandle) -> bool {
    reason(app).is_some_and(|r| r.updating)
}

pub fn request(app: &AppHandle) {
    begin(app, ExitRequest::default());
}
pub fn request_update(app: &AppHandle, automatic: bool) {
    begin(
        app,
        ExitRequest {
            updating: true,
            automatic,
            ..ExitRequest::default()
        },
    );
}
fn begin(app: &AppHandle, mut reason: ExitRequest) {
    let state = app.state::<ExitState>();
    let mut requested = state.requested.lock().unwrap();
    if requested.is_some() {
        return;
    }
    reason.id = state.next_id.fetch_add(1, Ordering::Relaxed);
    *requested = Some(reason);
    drop(requested);
    advance(app, None);
}

fn complete(app: &AppHandle, id: u32) {
    // A delayed main-window save must never skip a document's close prompt.
    if has_documents(app) {
        return;
    }
    if let Some(reason) = app.state::<ExitState>().complete(id) {
        app.exit(if reason.updating {
            super::updates::EXIT_TO_UPDATE
        } else {
            0
        });
    }
}

pub fn has_documents(app: &AppHandle) -> bool {
    app.webview_windows()
        .keys()
        .any(|label| label.starts_with("document-"))
}

pub fn advance(app: &AppHandle, closed: Option<&str>) {
    let Some(reason) = reason(app) else {
        return;
    };
    if (reason.automatic && !super::updates::automatic_eligible(app))
        || (reason.updating
            && app.get_webview_window("main").is_some()
            && !app.state::<ExitState>().ready.load(Ordering::Acquire))
    {
        cancel(app);
        return;
    }
    if let Some(window) = app
        .webview_windows()
        .values()
        .find(|w| w.label().starts_with("document-") && Some(w.label()) != closed)
    {
        let _ = window.show();
        let _ = window.set_focus();
        if let Err(error) = window.close() {
            cancel(app);
            log::error!("Could not close document before exit: {error}");
        }
        return;
    }
    if app.state::<ExitState>().ready.load(Ordering::Acquire) {
        if let Err(error) = app.emit_to("main", "app-exit-requested", reason) {
            cancel(app);
            log::error!("Could not request session save before exit: {error}");
        }
    } else {
        complete(app, reason.id);
    }
}

#[tauri::command]
pub fn app_exit_ready(window: WebviewWindow, ready: bool) {
    if window.label() == "main" {
        window
            .state::<ExitState>()
            .ready
            .store(ready, Ordering::Release);
    }
}

#[tauri::command]
pub fn app_exit_prepare_update(window: WebviewWindow, request_id: u32) -> Result<bool, String> {
    if window.label() == "main"
        && reason(window.app_handle()).is_some_and(|r| r.id == request_id && r.updating)
    {
        let visible = window.is_visible().map_err(|e| e.to_string())?;
        window.hide().map_err(|e| e.to_string())?;
        window
            .state::<ExitState>()
            .hidden_for_update
            .store(visible, Ordering::Release);
        super::background_if_no_windows(window.app_handle(), None);
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub fn app_update_blocked(window: WebviewWindow, blocked: bool) {
    if window.label() == "main" {
        window
            .state::<ExitState>()
            .update_blocked
            .store(blocked, Ordering::Release);
        if !blocked {
            super::updates::try_automatic(window.app_handle());
        }
    }
}

#[tauri::command]
pub fn app_exit_cancel(app: AppHandle, request_id: Option<u32>) {
    let state = app.state::<ExitState>();
    if state.cancel(request_id) && state.hidden_for_update.swap(false, Ordering::AcqRel) {
        super::show_main_window(&app);
    }
}

pub fn cancel(app: &AppHandle) {
    app_exit_cancel(app.clone(), None);
}

#[tauri::command]
pub fn app_exit_complete(window: WebviewWindow, request_id: u32) {
    if window.label() == "main" {
        complete(window.app_handle(), request_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancelled_save_cannot_complete_or_cancel_a_new_exit_request() {
        let state = ExitState::default();
        *state.requested.lock().unwrap() = Some(ExitRequest {
            id: 1,
            updating: true,
            ..Default::default()
        });
        assert!(state.cancel(Some(1)));
        *state.requested.lock().unwrap() = Some(ExitRequest {
            id: 2,
            updating: true,
            ..Default::default()
        });
        assert!(state.complete(1).is_none());
        assert!(!state.cancel(Some(1)));
        assert!(!state.requested.lock().unwrap().unwrap().completed);
        assert!(state.complete(2).unwrap().completed);
    }
}

// Tauri's macOS predefined Quit calls NSApplication terminate directly, which
// bypasses ExitRequested. Replace that item, preserving the rest of its menu.
#[cfg(any(target_os = "macos", target_os = "windows"))]
pub fn menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    let menu = Menu::default(app)?;
    let quit_text = PredefinedMenuItem::quit(app, None)?.text()?;
    for item in menu.items()? {
        if let Some(submenu) = item.as_submenu() {
            for (index, item) in submenu.items()?.iter().enumerate() {
                if let Some(predefined) = item.as_predefined_menuitem() {
                    if predefined.text()? == quit_text {
                        submenu.remove(predefined)?;
                        submenu.insert(
                            &MenuItem::with_id(
                                app,
                                "app-quit",
                                quit_text.clone(),
                                true,
                                Some("CmdOrCtrl+Q"),
                            )?,
                            index,
                        )?;
                    }
                }
            }
        }
    }
    Ok(menu)
}
