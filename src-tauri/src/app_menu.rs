use tauri::menu::{AboutMetadata, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Runtime};

#[path = "app_menu/view_checks.rs"]
mod view_checks;
pub(crate) use view_checks::set_panel_view_menu_checks;

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
pub(crate) const SELECT_BY_PATTERN_MENU_ITEM_ID: &str = "select_by_pattern";
pub(crate) const UNSELECT_BY_PATTERN_MENU_ITEM_ID: &str = "unselect_by_pattern";
pub(crate) const INVERT_SELECTION_MENU_ITEM_ID: &str = "invert_selection";
pub(crate) const CHECK_UPDATES_MENU_ITEM_ID: &str = "check_updates";
// 선택 도구 항목 ID는 "selection_command:<명령 ID>" 형식이며, 접두사 뒤 값을 프런트엔드로 그대로 보낸다.
// 체크섬 메뉴 ID는 "checksum:<generate|verify>" 형식이며 접두사 뒤 값을 프런트엔드로 보낸다.
pub(crate) const CHECKSUM_MENU_PREFIX: &str = "checksum:";
pub(crate) const SELECTION_COMMAND_MENU_PREFIX: &str = "selection_command:";

const SELECTION_TOOL_MENU_ITEMS: [(&str, &str, Option<&str>); 9] = [
    ("select-same-extension", "같은 확장자 전체 선택", None),
    ("save-selection", "선택 저장", None),
    ("restore-selection", "선택 복원", None),
    ("save-selection-to-file", "선택을 파일로 저장...", None),
    (
        "load-selection-from-file",
        "선택을 파일에서 불러오기...",
        None,
    ),
    ("copy-selected-names", "클립보드에 복사: 선택한 이름", None),
    ("copy-selected-paths", "클립보드에 복사: 경로와 이름", None),
    (
        "copy-selected-details",
        "클립보드에 복사: 모든 세부정보",
        None,
    ),
    (
        "copy-selected-path-details",
        "클립보드에 복사: 경로+세부정보",
        None,
    ),
];

fn app_menu_item<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<R>> {
    MenuItem::with_id(app, id, label, true, accelerator)
}

fn app_check_menu_item<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    label: &str,
    checked: bool,
    accelerator: Option<&str>,
) -> tauri::Result<CheckMenuItem<R>> {
    CheckMenuItem::with_id(app, id, label, true, checked, accelerator)
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

    let show_hidden_files = app_check_menu_item(
        app,
        SHOW_HIDDEN_MENU_ITEM_ID,
        "숨김 파일 표시",
        false,
        Some("CmdOrCtrl+Shift+Period"),
    )?;
    let left_view_mode_brief = app_check_menu_item(
        app,
        LEFT_VIEW_MODE_BRIEF_MENU_ITEM_ID,
        "간단히",
        false,
        None::<&str>,
    )?;
    let left_view_mode_detailed = app_check_menu_item(
        app,
        LEFT_VIEW_MODE_DETAILED_MENU_ITEM_ID,
        "자세히",
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
    let right_view_mode_brief = app_check_menu_item(
        app,
        RIGHT_VIEW_MODE_BRIEF_MENU_ITEM_ID,
        "간단히",
        false,
        None::<&str>,
    )?;
    let right_view_mode_detailed = app_check_menu_item(
        app,
        RIGHT_VIEW_MODE_DETAILED_MENU_ITEM_ID,
        "자세히",
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

    let theme_auto = app_check_menu_item(app, THEME_AUTO_MENU_ITEM_ID, "자동", true, None::<&str>)?;
    let theme_light =
        app_check_menu_item(app, THEME_LIGHT_MENU_ITEM_ID, "라이트", false, None::<&str>)?;
    let theme_dark =
        app_check_menu_item(app, THEME_DARK_MENU_ITEM_ID, "다크", false, None::<&str>)?;
    let theme_menu = Submenu::with_id_and_items(
        app,
        THEME_MENU_ID,
        "테마",
        true,
        &[&theme_auto, &theme_light, &theme_dark],
    )?;
    let recover_renderer = app_menu_item(
        app,
        RECOVER_RENDERER_MENU_ITEM_ID,
        "화면 복구",
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

    let new_folder = app_menu_item(app, NEW_FOLDER_MENU_ITEM_ID, "새 폴더", Some("F7"))?;
    let new_file = app_menu_item(app, NEW_FILE_MENU_ITEM_ID, "새 파일", Some("Shift+F4"))?;
    let multi_rename = app_menu_item(
        app,
        MULTI_RENAME_MENU_ITEM_ID,
        "일괄 이름 변경 도구",
        None::<&str>,
    )?;
    let settings = app_menu_item(app, SETTINGS_MENU_ITEM_ID, "설정", Some("CmdOrCtrl+,"))?;
    let folder_sync = app_menu_item(app, FOLDER_SYNC_MENU_ITEM_ID, "폴더 동기화", Some("F11"))?;
    let target_equals_source = app_menu_item(
        app,
        TARGET_EQUALS_SOURCE_MENU_ITEM_ID,
        "대상=원본",
        Some("CmdOrCtrl+Shift+M"),
    )?;
    let swap_panels = app_menu_item(
        app,
        SWAP_PANELS_MENU_ITEM_ID,
        "패널 교환",
        Some("CmdOrCtrl+U"),
    )?;
    let select_by_pattern = app_menu_item(
        app,
        SELECT_BY_PATTERN_MENU_ITEM_ID,
        "패턴으로 선택...",
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let unselect_by_pattern = app_menu_item(
        app,
        UNSELECT_BY_PATTERN_MENU_ITEM_ID,
        "패턴으로 선택 해제...",
        Some("CmdOrCtrl+Shift+D"),
    )?;
    let invert_selection = app_menu_item(
        app,
        INVERT_SELECTION_MENU_ITEM_ID,
        "선택 반전",
        Some("CmdOrCtrl+Shift+I"),
    )?;
    let checksum_generate = app_menu_item(
        app,
        &format!("{CHECKSUM_MENU_PREFIX}generate"),
        "체크섬 생성...",
        None::<&str>,
    )?;
    let checksum_verify = app_menu_item(
        app,
        &format!("{CHECKSUM_MENU_PREFIX}verify"),
        "체크섬 확인...",
        None::<&str>,
    )?;
    let selection_tool_items = SELECTION_TOOL_MENU_ITEMS
        .iter()
        .map(|(command_id, label, accelerator)| {
            app_menu_item(
                app,
                &format!("{SELECTION_COMMAND_MENU_PREFIX}{command_id}"),
                label,
                *accelerator,
            )
        })
        .collect::<tauri::Result<Vec<_>>>()?;
    let selection_tool_refs: Vec<&dyn tauri::menu::IsMenuItem<R>> = selection_tool_items
        .iter()
        .map(|item| item as &dyn tauri::menu::IsMenuItem<R>)
        .collect();
    let selection_tools_menu = Submenu::with_items(app, "선택 도구", true, &selection_tool_refs)?;
    let commands_menu = Submenu::with_id_and_items(
        app,
        COMMANDS_MENU_ID,
        "명령",
        true,
        &[
            &folder_sync,
            &target_equals_source,
            &swap_panels,
            &PredefinedMenuItem::separator(app)?,
            &select_by_pattern,
            &unselect_by_pattern,
            &invert_selection,
            &selection_tools_menu,
        ],
    )?;

    #[cfg(target_os = "macos")]
    let macos_check_updates = app_menu_item(
        app,
        CHECK_UPDATES_MENU_ITEM_ID,
        "업데이트 확인...",
        None::<&str>,
    )?;
    #[cfg(not(target_os = "macos"))]
    let check_updates = app_menu_item(
        app,
        CHECK_UPDATES_MENU_ITEM_ID,
        "업데이트 확인...",
        None::<&str>,
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
                    &macos_check_updates,
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
                    &checksum_generate,
                    &checksum_verify,
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
                    &check_updates,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::separator(app)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
                ],
            )?,
        ],
    )
}
