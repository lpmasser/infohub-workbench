use crate::features;
use crate::features::document::service::{
    files_from_args, forget_document_window, open_document_windows,
};
use crate::shared;
use std::path::Path;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, RunEvent, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_window_state::StateFlags;
mod autostart;
mod exit;
mod updates;
type ManagedSync = std::sync::Mutex<features::infohub::host::SyncHost>;

include!(concat!(env!("OUT_DIR"), "/icon_stamp.rs"));

pub fn run() {
    let _ = ICON_STAMP;
    log::info!("InfoHub Workbench starting");

    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    let mut log_builder = tauri_plugin_log::Builder::new().level(log_level).targets([
        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
    ]);

    if std::env::var("OTTERLY_LOG_FORMAT").as_deref() == Ok("json") {
        log_builder = log_builder.format(|callback, message, record| {
            callback.finish(format_args!(
                r#"{{"level":"{}","target":"{}","message":"{}"}}"#,
                record.level(),
                record.target(),
                message
            ))
        });
    }

    // Tauri's native relaunch and the official NSIS updater reuse managed argv.
    // Original file-open arguments are read from std::env separately.
    let mut environment = tauri::Env::default();
    environment.args_os.truncate(1);
    #[cfg(target_os = "linux")]
    if environment.appimage.is_some() {
        environment
            .args_os
            .push("--appimage-extract-and-run".into());
    }
    environment.args_os.push("--background".into());
    let builder = tauri::Builder::default().manage(environment);
    // A second launch (double clicking a file on Windows or Linux) hands its
    // arguments to this process and exits. It has to be the first plugin.
    // macOS keeps one instance itself and sends RunEvent::Opened instead.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        if args.iter().any(|arg| arg == "--quit") {
            exit::request(app);
            return;
        }
        let files = files_from_args(&args, Path::new(&cwd));
        if !files.is_empty() || !args.iter().any(|arg| arg == "--background") {
            open_files_or_main_window(app, files);
        }
    }));

    builder
        .manage(exit::ExitState::default())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(autostart::arguments()),
        ))
        .manage(features::watcher::service::WatcherState::default())
        .manage(features::document::service::DocumentState::default())
        .manage(features::search::service::SearchDbState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(log_builder.build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .setup(|app| {
            if quit_launch() {
                app.handle().exit(0);
                return Ok(());
            }
            #[cfg(target_os = "macos")]
            if background_launch() {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            app.set_menu(exit::menu(app.handle())?)?;
            let open = MenuItem::with_id(app, "open", "打开窗口", true, None::<&str>)?;
            let sync_status =
                MenuItem::with_id(app, "sync-status", "同步启动中", false, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &sync_status, &quit])?;
            let restart =
                MenuItem::with_id(app, "restart-update", "重启以更新", true, None::<&str>)?;
            app.manage(updates::Updates::new(
                menu.clone(),
                restart,
                sync_status.clone(),
            ));
            TrayIconBuilder::with_id("infohub")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("InfoHub Workbench")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "quit" => exit::request(app),
                    "restart-update" => updates::request(app, false),
                    _ => {}
                })
                .build(app)?;
            if let Err(error) = autostart::ensure(app.handle()) {
                log::error!("Could not enable autostart: {error}");
            }
            app.manage(ManagedSync::new(features::infohub::host::SyncHost::start(
                app.handle().clone(),
                sync_status,
            )));
            updates::start(app.handle().clone());
            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir().unwrap_or_default();
            let files = files_from_args(&args, &cwd);
            // macOS delivers opened files as events after setup, so it decides
            // about the main window on Ready instead.
            if !files.is_empty() || (!background_launch() && !cfg!(target_os = "macos")) {
                open_files_or_main_window(app.handle(), files);
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id.as_ref() == "app-quit" {
                exit::request(app);
            }
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    background_if_no_windows(window.app_handle(), None);
                    updates::try_automatic(window.app_handle());
                }
            }
            if let WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    window
                        .state::<exit::ExitState>()
                        .ready
                        .store(false, std::sync::atomic::Ordering::Release);
                }
                forget_document_window(window.app_handle(), window.label());
                if window.label().starts_with("document-") {
                    background_if_no_windows(window.app_handle(), Some(window.label()));
                    exit::advance(window.app_handle(), Some(window.label()));
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            exit::app_exit_ready,
            exit::app_update_blocked,
            exit::app_exit_prepare_update,
            exit::app_exit_complete,
            exit::app_exit_cancel,
            features::infohub::infohub_overview,
            features::infohub::infohub_sync_status,
            features::vault::service::open_vault,
            features::vault::service::open_vault_by_id,
            features::vault::service::list_vaults,
            features::vault::service::remove_vault_from_registry,
            features::vault::service::remember_last_vault,
            features::vault::service::get_last_vault_id,
            features::watcher::service::watch_vault,
            features::watcher::service::unwatch_vault,
            features::search::service::index_build,
            features::search::service::index_cancel,
            features::search::service::index_rebuild,
            features::search::service::index_search,
            features::search::service::index_suggest,
            features::search::service::index_suggest_files,
            features::search::service::index_suggest_planned,
            features::search::service::index_list_note_paths_by_prefix,
            features::search::service::index_upsert_note,
            features::search::service::index_remove_note,
            features::search::service::index_remove_notes,
            features::search::service::index_remove_notes_by_prefix,
            features::search::service::index_rename_note,
            features::search::service::index_rename_folder,
            features::search::service::index_note_links_snapshot,
            features::search::service::index_extract_local_note_links,
            features::search::service::rewrite_note_links,
            features::search::service::resolve_note_link,
            features::notes::service::list_notes,
            features::notes::service::list_folders,
            features::notes::service::read_note,
            features::notes::service::read_note_meta,
            features::notes::service::write_note,
            features::notes::service::apply_markdown_cleanup,
            features::notes::service::get_latest_markdown_cleanup_backup,
            features::notes::service::restore_latest_markdown_cleanup,
            features::notes::service::create_note,
            features::notes::service::create_folder,
            features::notes::service::write_image_asset,
            features::notes::service::rename_note,
            features::notes::service::delete_note,
            features::notes::service::rename_folder,
            features::notes::service::move_items,
            features::notes::service::delete_folder,
            features::notes::service::list_folder_contents,
            features::document::service::read_document,
            features::document::service::write_document,
            features::notes::service::get_folder_stats,
            features::shell::service::reveal_in_file_manager,
            features::shell::service::open_in_default_app,
            features::settings::service::get_setting,
            features::settings::service::set_setting,
            features::vault_session::service::load_latest_vault_session,
            features::vault_session::service::save_latest_vault_session,
            features::vault_settings::service::get_vault_setting,
            features::vault_settings::service::set_vault_setting,
            features::git::service::git_has_repo,
            features::git::service::git_init_repo,
            features::git::service::git_status,
            features::git::service::git_stage_and_commit,
            features::git::service::git_log,
            features::git::service::git_diff,
            features::git::service::git_show_file_at_commit,
            features::git::service::git_restore_file,
            features::git::service::git_create_tag
        ])
        .register_uri_scheme_protocol("otterly-asset", |ctx, req| {
            shared::storage::handle_asset_request(ctx.app_handle(), req)
        })
        .build(app_context())
        .expect("error while building tauri application")
        .run(handle_run_event);
}

#[allow(unused_variables)]
fn app_context() -> tauri::Context<tauri::Wry> {
    tauri::generate_context!()
}

fn handle_run_event(app: &AppHandle, event: RunEvent) {
    if let RunEvent::ExitRequested { api, code, .. } = &event {
        if let Some(code) = code {
            if app
                .try_state::<ManagedSync>()
                .is_some_and(|host| host.lock().unwrap().request_exit(app.clone(), *code))
            {
                api.prevent_exit();
            } else if *code == updates::EXIT_TO_UPDATE {
                api.prevent_exit();
                updates::install(app);
            }
        } else {
            api.prevent_exit();
        }
    }
    #[cfg(target_os = "macos")]
    match event {
        RunEvent::Opened { urls } => {
            if !prepare_to_open(app) {
                return;
            }
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
            let files = urls
                .into_iter()
                .filter_map(|url| url.to_file_path().ok())
                .collect();
            open_document_windows(app, files);
        }
        // Launching by opening a file delivers Opened before Ready, so a plain
        // launch is the one that reaches Ready with no windows.
        RunEvent::Ready
            if !background_launch() && !quit_launch() && app.webview_windows().is_empty() =>
        {
            show_main_window(app)
        }
        // Clicking the dock icon with every window closed.
        RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } => show_main_window(app),
        _ => {}
    }
}

fn background_launch() -> bool {
    std::env::args().any(|arg| arg == "--background")
}

fn quit_launch() -> bool {
    std::env::args().any(|arg| arg == "--quit")
}

fn background_if_no_windows(app: &AppHandle, closed: Option<&str>) {
    #[cfg(target_os = "macos")]
    if !app
        .webview_windows()
        .values()
        .any(|w| Some(w.label()) != closed && w.is_visible().unwrap_or(false))
    {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, closed);
}

fn prepare_to_open(app: &AppHandle) -> bool {
    if updates::is_applying(app) {
        return false;
    }
    if exit::is_updating(app) {
        exit::cancel(app);
    }
    true
}

fn open_files_or_main_window(app: &AppHandle, files: Vec<std::path::PathBuf>) {
    if !prepare_to_open(app) {
        return;
    }
    if files.is_empty() {
        show_main_window(app);
    } else {
        open_document_windows(app, files);
    }
}

// The vault window. tauri.conf.json declares it with create: false, so a
// launch that only opens a file does not show an empty vault picker too.
fn show_main_window(app: &AppHandle) {
    if !prepare_to_open(app) {
        return;
    }
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return;
    }
    let Some(config) = app.config().app.windows.iter().find(|w| w.label == "main") else {
        log::error!("tauri.conf.json has no main window");
        return;
    };
    let built = WebviewWindowBuilder::from_config(app, config).and_then(|b| b.build());
    if let Err(error) = built {
        log::error!("Could not create the main window: {}", error);
    }
}
