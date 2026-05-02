use tauri::menu::{AboutMetadata, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Runtime};

pub(crate) const FILE_MENU_ID: &str = "file";
pub(crate) const NEW_FOLDER_MENU_ITEM_ID: &str = "new_folder";
pub(crate) const NEW_FILE_MENU_ITEM_ID: &str = "new_file";
pub(crate) const MULTI_RENAME_MENU_ITEM_ID: &str = "multi_rename";
pub(crate) const SETTINGS_MENU_ITEM_ID: &str = "settings";
pub(crate) const SHOW_HIDDEN_MENU_ITEM_ID: &str = "show_hidden_files";
pub(crate) const VIEW_MENU_ID: &str = "view";
pub(crate) const LEFT_PANEL_VIEW_MENU_ID: &str = "left_panel_view";
pub(crate) const RIGHT_PANEL_VIEW_MENU_ID: &str = "right_panel_view";
pub(crate) const LEFT_VIEW_MODE_BRIEF_MENU_ITEM_ID: &str = "left_view_mode_brief";
pub(crate) const LEFT_VIEW_MODE_DETAILED_MENU_ITEM_ID: &str = "left_view_mode_detailed";
pub(crate) const RIGHT_VIEW_MODE_BRIEF_MENU_ITEM_ID: &str = "right_view_mode_brief";
pub(crate) const RIGHT_VIEW_MODE_DETAILED_MENU_ITEM_ID: &str = "right_view_mode_detailed";
pub(crate) const RECOVER_RENDERER_MENU_ITEM_ID: &str = "recover_renderer";
pub(crate) const THEME_MENU_ID: &str = "theme";
pub(crate) const THEME_AUTO_MENU_ITEM_ID: &str = "theme_auto";
pub(crate) const THEME_LIGHT_MENU_ITEM_ID: &str = "theme_light";
pub(crate) const THEME_DARK_MENU_ITEM_ID: &str = "theme_dark";
pub(crate) const COMMANDS_MENU_ID: &str = "commands";
pub(crate) const FOLDER_SYNC_MENU_ITEM_ID: &str = "folder_sync";
pub(crate) const TARGET_EQUALS_SOURCE_MENU_ITEM_ID: &str = "target_equals_source";
pub(crate) const SWAP_PANELS_MENU_ITEM_ID: &str = "swap_panels";

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

pub(crate) fn build_app_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let pkg_info = app.package_info();
    let config = app.config();
    let about_metadata = AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
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
    let recover_renderer = MenuItem::with_id(
        app,
        RECOVER_RENDERER_MENU_ITEM_ID,
        "화면 복구",
        true,
        Some("CmdOrCtrl+Shift+R"),
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

    let new_folder = MenuItem::with_id(app, NEW_FOLDER_MENU_ITEM_ID, "새 폴더", true, Some("F7"))?;
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
    let settings = MenuItem::with_id(
        app,
        SETTINGS_MENU_ITEM_ID,
        "설정",
        true,
        Some("CmdOrCtrl+,"),
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
                    &PredefinedMenuItem::about(app, None, Some(about_metadata.clone()))?,
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
                    &settings,
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
                    &recover_renderer,
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
