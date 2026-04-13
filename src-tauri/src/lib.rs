mod commands;

use tauri::menu::{AboutMetadata, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};

const FILE_MENU_ID: &str = "file";
const NEW_FOLDER_MENU_ITEM_ID: &str = "new_folder";
const NEW_FILE_MENU_ITEM_ID: &str = "new_file";
const MULTI_RENAME_MENU_ITEM_ID: &str = "multi_rename";
const SHOW_HIDDEN_MENU_ITEM_ID: &str = "show_hidden_files";
const VIEW_MENU_ID: &str = "view";
const LEFT_PANEL_VIEW_MENU_ID: &str = "left_panel_view";
const RIGHT_PANEL_VIEW_MENU_ID: &str = "right_panel_view";
const LEFT_VIEW_MODE_BRIEF_MENU_ITEM_ID: &str = "left_view_mode_brief";
const LEFT_VIEW_MODE_DETAILED_MENU_ITEM_ID: &str = "left_view_mode_detailed";
const RIGHT_VIEW_MODE_BRIEF_MENU_ITEM_ID: &str = "right_view_mode_brief";
const RIGHT_VIEW_MODE_DETAILED_MENU_ITEM_ID: &str = "right_view_mode_detailed";
const THEME_MENU_ID: &str = "theme";
const THEME_AUTO_MENU_ITEM_ID: &str = "theme_auto";
const THEME_LIGHT_MENU_ITEM_ID: &str = "theme_light";
const THEME_DARK_MENU_ITEM_ID: &str = "theme_dark";
const COMMANDS_MENU_ID: &str = "commands";
const FOLDER_SYNC_MENU_ITEM_ID: &str = "folder_sync";
const TARGET_EQUALS_SOURCE_MENU_ITEM_ID: &str = "target_equals_source";
const SWAP_PANELS_MENU_ITEM_ID: &str = "swap_panels";

fn get_panel_view_submenu<R: Runtime>(app: &AppHandle<R>, submenu_id: &str) -> Option<Submenu<R>> {
    let menu = app.menu()?;
    let view_menu = menu
        .get(VIEW_MENU_ID)?
        .as_submenu()
        .cloned()?;

    view_menu
        .get(submenu_id)?
        .as_submenu()
        .cloned()
}

fn set_panel_view_menu_checks<R: Runtime>(
    app: &AppHandle<R>,
    submenu_id: &str,
    brief_item_id: &str,
    detailed_item_id: &str,
    view_mode: &str,
) {
    let Some(submenu) = get_panel_view_submenu(app, submenu_id) else {
        return;
    };

    for (item_id, is_checked) in [
        (brief_item_id, view_mode == "brief"),
        (detailed_item_id, view_mode == "detailed"),
    ] {
        if let Some(item) = submenu
            .get(item_id)
            .and_then(|menu_item| menu_item.as_check_menuitem().cloned())
        {
            let _ = item.set_checked(is_checked);
        }
    }
}

fn build_app_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let pkg_info = app.package_info();
    let config = app.config();
    let about_metadata = AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config.bundle.publisher.clone().map(|publisher| vec![publisher]),
        ..Default::default()
    };

    let show_hidden_files = CheckMenuItem::with_id(
        app,
        SHOW_HIDDEN_MENU_ITEM_ID,
        "숨김 파일 표시",
        true,
        false,
        Some("CmdOrCtrl+Shift+Period"),
    )?;
    let left_view_mode_brief = CheckMenuItem::with_id(
        app,
        LEFT_VIEW_MODE_BRIEF_MENU_ITEM_ID,
        "간단히",
        true,
        false,
        None::<&str>,
    )?;
    let left_view_mode_detailed = CheckMenuItem::with_id(
        app,
        LEFT_VIEW_MODE_DETAILED_MENU_ITEM_ID,
        "자세히",
        true,
        true,
        None::<&str>,
    )?;
    let left_panel_view_menu = Submenu::with_id_and_items(
        app,
        LEFT_PANEL_VIEW_MENU_ID,
        "왼쪽 패널",
        true,
        &[&left_view_mode_brief, &left_view_mode_detailed],
    )?;
    let right_view_mode_brief = CheckMenuItem::with_id(
        app,
        RIGHT_VIEW_MODE_BRIEF_MENU_ITEM_ID,
        "간단히",
        true,
        false,
        None::<&str>,
    )?;
    let right_view_mode_detailed = CheckMenuItem::with_id(
        app,
        RIGHT_VIEW_MODE_DETAILED_MENU_ITEM_ID,
        "자세히",
        true,
        true,
        None::<&str>,
    )?;
    let right_panel_view_menu = Submenu::with_id_and_items(
        app,
        RIGHT_PANEL_VIEW_MENU_ID,
        "오른쪽 패널",
        true,
        &[&right_view_mode_brief, &right_view_mode_detailed],
    )?;

    let theme_auto = CheckMenuItem::with_id(
        app,
        THEME_AUTO_MENU_ITEM_ID,
        "자동",
        true,
        true,
        None::<&str>,
    )?;
    let theme_light = CheckMenuItem::with_id(
        app,
        THEME_LIGHT_MENU_ITEM_ID,
        "라이트",
        true,
        false,
        None::<&str>,
    )?;
    let theme_dark = CheckMenuItem::with_id(
        app,
        THEME_DARK_MENU_ITEM_ID,
        "다크",
        true,
        false,
        None::<&str>,
    )?;
    let theme_menu = Submenu::with_id_and_items(
        app,
        THEME_MENU_ID,
        "테마",
        true,
        &[&theme_auto, &theme_light, &theme_dark],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "창",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let new_folder = MenuItem::with_id(
        app,
        NEW_FOLDER_MENU_ITEM_ID,
        "새 폴더",
        true,
        Some("F7"),
    )?;
    let new_file = MenuItem::with_id(
        app,
        NEW_FILE_MENU_ITEM_ID,
        "새 파일",
        true,
        Some("Shift+F4"),
    )?;
    let multi_rename = MenuItem::with_id(
        app,
        MULTI_RENAME_MENU_ITEM_ID,
        "일괄 이름 변경 도구",
        true,
        None::<&str>,
    )?;
    let folder_sync = MenuItem::with_id(
        app,
        FOLDER_SYNC_MENU_ITEM_ID,
        "폴더 동기화",
        true,
        Some("F11"),
    )?;
    let target_equals_source = MenuItem::with_id(
        app,
        TARGET_EQUALS_SOURCE_MENU_ITEM_ID,
        "대상=원본",
        true,
        Some("CmdOrCtrl+Shift+M"),
    )?;
    let swap_panels = MenuItem::with_id(
        app,
        SWAP_PANELS_MENU_ITEM_ID,
        "패널 교환",
        true,
        Some("CmdOrCtrl+U"),
    )?;
    let commands_menu = Submenu::with_id_and_items(
        app,
        COMMANDS_MENU_ID,
        "명령",
        true,
        &[&folder_sync, &target_equals_source, &swap_panels],
    )?;


    Menu::with_items(
        app,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                pkg_info.name.clone(),
                true,
                &[
                    &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?,
            &Submenu::with_id_and_items(
                app,
                FILE_MENU_ID,
                "파일",
                true,
                &[
                    &new_folder,
                    &new_file,
                    &multi_rename,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::separator(app)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "편집",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?,
            &Submenu::with_id_and_items(
                app,
                VIEW_MENU_ID,
                "보기",
                true,
                &[
                    &left_panel_view_menu,
                    &right_panel_view_menu,
                    &PredefinedMenuItem::separator(app)?,
                    &show_hidden_files,
                    &theme_menu,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::fullscreen(app, None)?,
                ],
            )?,
            &commands_menu,
            &window_menu,
            &Submenu::with_items(
                app,
                "도움말",
                true,
                &[
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
                ],
            )?,
        ],
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(|app| build_app_menu(app))
        .on_menu_event(|app, event| {
            let event_id = event.id().as_ref();

            match event_id {
                NEW_FOLDER_MENU_ITEM_ID => {
                    let _ = app.emit("new-folder-requested", ());
                }
                NEW_FILE_MENU_ITEM_ID => {
                    let _ = app.emit("new-file-requested", ());
                }
                MULTI_RENAME_MENU_ITEM_ID => {
                    let _ = app.emit("multi-rename-requested", ());
                }
                FOLDER_SYNC_MENU_ITEM_ID => {
                    let _ = app.emit("folder-sync-requested", ());
                }
                TARGET_EQUALS_SOURCE_MENU_ITEM_ID => {
                    let _ = app.emit("target-equals-source-requested", ());
                }
                SWAP_PANELS_MENU_ITEM_ID => {
                    let _ = app.emit("swap-panels-requested", ());
                }
                commands::system_commands::CONTEXT_INFO_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "info");
                }
                commands::system_commands::CONTEXT_REVEAL_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "reveal");
                }
                commands::system_commands::CONTEXT_TERMINAL_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "terminal");
                }
                commands::system_commands::CONTEXT_CREATE_ZIP_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "create-zip");
                }
                commands::system_commands::CONTEXT_EXTRACT_ZIP_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "extract-zip");
                }
                commands::system_commands::CONTEXT_COPY_PATH_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "copy-path");
                }
                commands::system_commands::CONTEXT_COPY_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "copy");
                }
                commands::system_commands::CONTEXT_MOVE_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "move");
                }
                commands::system_commands::CONTEXT_RENAME_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "rename");
                }
                commands::system_commands::CONTEXT_DELETE_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "delete");
                }
                commands::system_commands::CONTEXT_REFRESH_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "refresh");
                }
                commands::system_commands::CONTEXT_NEW_FOLDER_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "mkdir");
                }
                commands::system_commands::CONTEXT_NEW_FILE_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "newfile");
                }
                commands::system_commands::CONTEXT_SEARCH_MENU_ITEM_ID => {
                    let _ = app.emit("context-menu-action", "search");
                }
                _ => {}
            }

            if event_id == SHOW_HIDDEN_MENU_ITEM_ID {
                if let Some(menu) = app.menu() {
                    if let Some(view_menu) = menu.get(VIEW_MENU_ID).and_then(|item| item.as_submenu().cloned()) {
                        if let Some(checked) = view_menu
                            .get(SHOW_HIDDEN_MENU_ITEM_ID)
                            .and_then(|item| item.as_check_menuitem().cloned())
                            .and_then(|item| item.is_checked().ok())
                        {
                            let _ = app.emit("show-hidden-files-changed", checked);
                        }
                    }
                }
            }

            let theme = match event_id {
                THEME_AUTO_MENU_ITEM_ID => Some("auto"),
                THEME_LIGHT_MENU_ITEM_ID => Some("light"),
                THEME_DARK_MENU_ITEM_ID => Some("dark"),
                _ => None,
            };

            if let Some(theme) = theme {
                let _ = app.emit("theme-preference-changed", theme);
            }

            let panel_view_mode = match event_id {
                LEFT_VIEW_MODE_BRIEF_MENU_ITEM_ID => Some(("left", "brief")),
                LEFT_VIEW_MODE_DETAILED_MENU_ITEM_ID => Some(("left", "detailed")),
                RIGHT_VIEW_MODE_BRIEF_MENU_ITEM_ID => Some(("right", "brief")),
                RIGHT_VIEW_MODE_DETAILED_MENU_ITEM_ID => Some(("right", "detailed")),
                _ => None,
            };

            if let Some((panel, view_mode)) = panel_view_mode {
                match panel {
                    "left" => set_panel_view_menu_checks(
                        app,
                        LEFT_PANEL_VIEW_MENU_ID,
                        LEFT_VIEW_MODE_BRIEF_MENU_ITEM_ID,
                        LEFT_VIEW_MODE_DETAILED_MENU_ITEM_ID,
                        view_mode,
                    ),
                    "right" => set_panel_view_menu_checks(
                        app,
                        RIGHT_PANEL_VIEW_MENU_ID,
                        RIGHT_VIEW_MODE_BRIEF_MENU_ITEM_ID,
                        RIGHT_VIEW_MODE_DETAILED_MENU_ITEM_ID,
                        view_mode,
                    ),
                    _ => {}
                }

                let _ = app.emit(
                    "panel-view-mode-changed",
                    serde_json::json!({
                        "panel": panel,
                        "viewMode": view_mode,
                    }),
                );
            }
        })
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            use tauri::Manager;
            use tauri_plugin_window_state::{StateFlags, WindowExt};
            if let Some(window) = app.get_webview_window("main") {
                let flags = StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED;
                let _ = window.restore_state(flags);
            }
            Ok(())
        })
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::system_commands::get_drives,
            commands::system_commands::get_home_dir,
            commands::system_commands::get_available_space,
            commands::system_commands::open_in_terminal,
            commands::system_commands::open_in_editor,
            commands::system_commands::open_file,
            commands::system_commands::run_shell_command,
            commands::system_commands::quit_app,
            commands::system_commands::show_context_menu,
            commands::system_commands::set_show_hidden_menu_checked,
            commands::system_commands::set_theme_menu_selection,
            commands::system_commands::set_view_mode_menu_selection,
            commands::fs_commands::list_directory,
            commands::fs_commands::create_directory,
            commands::fs_commands::create_file,
            commands::fs_commands::delete_files,
            commands::fs_commands::rename_file,
            commands::fs_commands::apply_batch_rename,
            commands::fs_commands::copy_files,
            commands::fs_commands::move_files,
            commands::fs_commands::check_copy_conflicts,
            commands::fs_commands::extract_zip,
            commands::fs_commands::create_zip,
            commands::fs_commands::create_zip_from_paths,
            commands::fs_commands::read_file_content,
            commands::search_commands::search_files,
            commands::fs_commands::get_dir_size,
            commands::drag_commands::start_native_drag,
            commands::sync_commands::compare_directories,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
