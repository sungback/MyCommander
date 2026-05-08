use super::VIEW_MENU_ID;
use tauri::menu::Submenu;
use tauri::{AppHandle, Runtime};

fn get_panel_view_submenu<R: Runtime>(app: &AppHandle<R>, submenu_id: &str) -> Option<Submenu<R>> {
    let menu = app.menu()?;
    let view_menu = menu.get(VIEW_MENU_ID)?.as_submenu().cloned()?;

    view_menu.get(submenu_id)?.as_submenu().cloned()
}

pub(crate) fn set_panel_view_menu_checks<R: Runtime>(
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
