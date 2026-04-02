mod commands;

use tauri::menu::{AboutMetadata, CheckMenuItem, Menu, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};

const SHOW_HIDDEN_MENU_ITEM_ID: &str = "show_hidden_files";
const VIEW_MENU_ID: &str = "view";
const THEME_MENU_ID: &str = "theme";
const THEME_AUTO_MENU_ITEM_ID: &str = "theme_auto";
const THEME_LIGHT_MENU_ITEM_ID: &str = "theme_light";
const THEME_DARK_MENU_ITEM_ID: &str = "theme_dark";

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
        "Show Hidden Files",
        true,
        false,
        Some("CmdOrCtrl+Shift+Period"),
    )?;

    let theme_auto = CheckMenuItem::with_id(
        app,
        THEME_AUTO_MENU_ITEM_ID,
        "Auto",
        true,
        true,
        None::<&str>,
    )?;
    let theme_light = CheckMenuItem::with_id(
        app,
        THEME_LIGHT_MENU_ITEM_ID,
        "Light",
        true,
        false,
        None::<&str>,
    )?;
    let theme_dark = CheckMenuItem::with_id(
        app,
        THEME_DARK_MENU_ITEM_ID,
        "Dark",
        true,
        false,
        None::<&str>,
    )?;
    let theme_menu = Submenu::with_id_and_items(
        app,
        THEME_MENU_ID,
        "Theme",
        true,
        &[&theme_auto, &theme_light, &theme_dark],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
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
            &Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &PredefinedMenuItem::close_window(app, None)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::separator(app)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
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
                "View",
                true,
                &[
                    &show_hidden_files,
                    &theme_menu,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::fullscreen(app, None)?,
                ],
            )?,
            &window_menu,
            &Submenu::with_items(
                app,
                "Help",
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
        })
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
            commands::system_commands::quit_app,
            commands::system_commands::set_show_hidden_menu_checked,
            commands::system_commands::set_theme_menu_selection,
            commands::fs_commands::list_directory,
            commands::fs_commands::create_directory,
            commands::fs_commands::create_file,
            commands::fs_commands::delete_files,
            commands::fs_commands::rename_file,
            commands::fs_commands::copy_files,
            commands::fs_commands::move_files,
            commands::fs_commands::extract_zip,
            commands::fs_commands::read_file_content,
            commands::search_commands::search_files,
            commands::fs_commands::get_dir_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
