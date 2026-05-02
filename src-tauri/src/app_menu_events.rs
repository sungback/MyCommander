use super::{
    set_panel_view_menu_checks, FOLDER_SYNC_MENU_ITEM_ID, LEFT_PANEL_VIEW_MENU_ID,
    LEFT_VIEW_MODE_BRIEF_MENU_ITEM_ID, LEFT_VIEW_MODE_DETAILED_MENU_ITEM_ID,
    MULTI_RENAME_MENU_ITEM_ID, NEW_FILE_MENU_ITEM_ID, NEW_FOLDER_MENU_ITEM_ID,
    RECOVER_RENDERER_MENU_ITEM_ID, RIGHT_PANEL_VIEW_MENU_ID, RIGHT_VIEW_MODE_BRIEF_MENU_ITEM_ID,
    RIGHT_VIEW_MODE_DETAILED_MENU_ITEM_ID, SETTINGS_MENU_ITEM_ID, SHOW_HIDDEN_MENU_ITEM_ID,
    SWAP_PANELS_MENU_ITEM_ID, TARGET_EQUALS_SOURCE_MENU_ITEM_ID, THEME_AUTO_MENU_ITEM_ID,
    THEME_DARK_MENU_ITEM_ID, THEME_LIGHT_MENU_ITEM_ID, VIEW_MENU_ID,
};
use crate::commands;
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub(crate) fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event_id: &str) {
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
        SETTINGS_MENU_ITEM_ID => {
            let _ = app.emit("settings-requested", ());
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
        RECOVER_RENDERER_MENU_ITEM_ID => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.reload();
            }
        }
        commands::system::menu::CONTEXT_INFO_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "info");
        }
        commands::system::menu::CONTEXT_REVEAL_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "reveal");
        }
        commands::system::menu::CONTEXT_TERMINAL_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "terminal");
        }
        commands::system::menu::CONTEXT_CREATE_ZIP_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "create-zip");
        }
        commands::system::menu::CONTEXT_EXTRACT_ZIP_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "extract-zip");
        }
        commands::system::menu::CONTEXT_COPY_PATH_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "copy-path");
        }
        commands::system::menu::CONTEXT_COPY_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "copy");
        }
        commands::system::menu::CONTEXT_MOVE_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "move");
        }
        commands::system::menu::CONTEXT_RENAME_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "rename");
        }
        commands::system::menu::CONTEXT_DELETE_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "delete");
        }
        commands::system::menu::CONTEXT_REFRESH_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "refresh");
        }
        commands::system::menu::CONTEXT_NEW_FOLDER_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "mkdir");
        }
        commands::system::menu::CONTEXT_NEW_FILE_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "newfile");
        }
        commands::system::menu::CONTEXT_SEARCH_MENU_ITEM_ID => {
            let _ = app.emit("context-menu-action", "search");
        }
        _ => {}
    }

    if event_id == SHOW_HIDDEN_MENU_ITEM_ID {
        if let Some(menu) = app.menu() {
            if let Some(view_menu) = menu
                .get(VIEW_MENU_ID)
                .and_then(|item| item.as_submenu().cloned())
            {
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
}
