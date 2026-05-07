#[tauri::command(rename_all = "snake_case")]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_show_hidden_menu_checked(app: tauri::AppHandle, checked: bool) -> Result<(), String> {
    let menu = app
        .menu()
        .ok_or_else(|| "Application menu is not available".to_string())?;

    let view_menu = menu
        .get("view")
        .and_then(|item| item.as_submenu().cloned())
        .ok_or_else(|| "View menu is not available".to_string())?;

    let show_hidden_item = view_menu
        .get("show_hidden_files")
        .and_then(|item| item.as_check_menuitem().cloned())
        .ok_or_else(|| "Show Hidden Files menu item is not available".to_string())?;

    show_hidden_item
        .set_checked(checked)
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_theme_menu_selection(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    let menu = app
        .menu()
        .ok_or_else(|| "Application menu is not available".to_string())?;

    let view_menu = menu
        .get("view")
        .and_then(|item| item.as_submenu().cloned())
        .ok_or_else(|| "View menu is not available".to_string())?;

    let theme_menu = view_menu
        .get("theme")
        .and_then(|item| item.as_submenu().cloned())
        .ok_or_else(|| "Theme menu is not available".to_string())?;

    for (item_id, is_checked) in [
        ("theme_auto", theme == "auto"),
        ("theme_light", theme == "light"),
        ("theme_dark", theme == "dark"),
    ] {
        let item = theme_menu
            .get(item_id)
            .and_then(|menu_item| menu_item.as_check_menuitem().cloned())
            .ok_or_else(|| format!("{item_id} menu item is not available"))?;

        item.set_checked(is_checked)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_view_mode_menu_selection(
    app: tauri::AppHandle,
    left_mode: String,
    right_mode: String,
) -> Result<(), String> {
    let menu = app
        .menu()
        .ok_or_else(|| "Application menu is not available".to_string())?;

    let view_menu = menu
        .get("view")
        .and_then(|item| item.as_submenu().cloned())
        .ok_or_else(|| "View menu is not available".to_string())?;

    for (item_id, is_checked) in [
        ("left_view_mode_brief", left_mode == "brief"),
        ("left_view_mode_detailed", left_mode == "detailed"),
        ("right_view_mode_brief", right_mode == "brief"),
        ("right_view_mode_detailed", right_mode == "detailed"),
    ] {
        let item = view_menu
            .get(item_id)
            .and_then(|menu_item| menu_item.as_check_menuitem().cloned())
            .or_else(|| {
                view_menu
                    .get("left_panel_view")
                    .and_then(|item| item.as_submenu().cloned())
                    .and_then(|submenu| submenu.get(item_id))
                    .and_then(|item| item.as_check_menuitem().cloned())
            })
            .or_else(|| {
                view_menu
                    .get("right_panel_view")
                    .and_then(|item| item.as_submenu().cloned())
                    .and_then(|submenu| submenu.get(item_id))
                    .and_then(|item| item.as_check_menuitem().cloned())
            })
            .ok_or_else(|| format!("{item_id} menu item is not available"))?;

        item.set_checked(is_checked)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}
