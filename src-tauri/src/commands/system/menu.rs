use serde::Deserialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{LogicalPosition, Position, Window};

pub const CONTEXT_INFO_MENU_ITEM_ID: &str = "context_info";
pub const CONTEXT_REVEAL_MENU_ITEM_ID: &str = "context_reveal";
pub const CONTEXT_TERMINAL_MENU_ITEM_ID: &str = "context_terminal";
pub const CONTEXT_CREATE_ZIP_MENU_ITEM_ID: &str = "context_create_zip";
pub const CONTEXT_EXTRACT_ZIP_MENU_ITEM_ID: &str = "context_extract_zip";
pub const CONTEXT_PASTE_MENU_ITEM_ID: &str = "context_paste";
pub const CONTEXT_COPY_PATH_MENU_ITEM_ID: &str = "context_copy_path";
pub const CONTEXT_COPY_MENU_ITEM_ID: &str = "context_copy";
pub const CONTEXT_MOVE_MENU_ITEM_ID: &str = "context_move";
pub const CONTEXT_RENAME_MENU_ITEM_ID: &str = "context_rename";
pub const CONTEXT_NORMALIZE_NFC_MENU_ITEM_ID: &str = "context_normalize_nfc";
pub const CONTEXT_DELETE_MENU_ITEM_ID: &str = "context_delete";
pub const CONTEXT_REFRESH_MENU_ITEM_ID: &str = "context_refresh";
pub const CONTEXT_NEW_FOLDER_MENU_ITEM_ID: &str = "context_new_folder";
pub const CONTEXT_NEW_FILE_MENU_ITEM_ID: &str = "context_new_file";
pub const CONTEXT_SEARCH_MENU_ITEM_ID: &str = "context_search";

const CONTEXT_CREATE_ZIP_MENU_LABEL: &str = "압축";
const CONTEXT_EXTRACT_ZIP_MENU_LABEL: &str = "압축 해제";

#[derive(Deserialize)]
pub struct ShowContextMenuRequest {
    pub x: f64,
    pub y: f64,
    pub has_target_item: bool,
    pub can_rename: bool,
    pub can_normalize_filename: bool,
    pub can_create_zip: bool,
    pub can_extract_zip: bool,
}

#[cfg(target_os = "macos")]
const OPEN_LOCATION_MENU_LABEL: &str = "Finder 열기";
#[cfg(target_os = "windows")]
const OPEN_LOCATION_MENU_LABEL: &str = "탐색기 열기";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const OPEN_LOCATION_MENU_LABEL: &str = "위치 열기";

#[tauri::command(rename_all = "snake_case")]
pub fn show_context_menu(window: Window, request: ShowContextMenuRequest) -> Result<(), String> {
    let menu = if request.has_target_item {
        build_target_context_menu(
            &window,
            request.can_rename,
            request.can_normalize_filename,
            request.can_create_zip,
            request.can_extract_zip,
        )?
    } else {
        build_background_context_menu(&window)?
    };

    window
        .popup_menu_at(
            &menu,
            Position::Logical(LogicalPosition::new(request.x, request.y)),
        )
        .map_err(|error| error.to_string())
}

fn build_target_context_menu(
    window: &Window,
    can_rename: bool,
    can_normalize_filename: bool,
    can_create_zip: bool,
    can_extract_zip: bool,
) -> Result<Menu<tauri::Wry>, String> {
    let info = MenuItem::with_id(
        window,
        CONTEXT_INFO_MENU_ITEM_ID,
        "속성",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let reveal = MenuItem::with_id(
        window,
        CONTEXT_REVEAL_MENU_ITEM_ID,
        OPEN_LOCATION_MENU_LABEL,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let terminal = MenuItem::with_id(
        window,
        CONTEXT_TERMINAL_MENU_ITEM_ID,
        "터미널에서 열기",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let create_zip = MenuItem::with_id(
        window,
        CONTEXT_CREATE_ZIP_MENU_ITEM_ID,
        CONTEXT_CREATE_ZIP_MENU_LABEL,
        can_create_zip,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let extract_zip = MenuItem::with_id(
        window,
        CONTEXT_EXTRACT_ZIP_MENU_ITEM_ID,
        CONTEXT_EXTRACT_ZIP_MENU_LABEL,
        can_extract_zip,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let paste = MenuItem::with_id(
        window,
        CONTEXT_PASTE_MENU_ITEM_ID,
        "붙여넣기",
        false,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let copy_path = MenuItem::with_id(
        window,
        CONTEXT_COPY_PATH_MENU_ITEM_ID,
        "경로 복사",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let copy = MenuItem::with_id(
        window,
        CONTEXT_COPY_MENU_ITEM_ID,
        "복사",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let move_item = MenuItem::with_id(
        window,
        CONTEXT_MOVE_MENU_ITEM_ID,
        "이동",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let rename = MenuItem::with_id(
        window,
        CONTEXT_RENAME_MENU_ITEM_ID,
        "이름 바꾸기",
        can_rename,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let normalize_nfc = MenuItem::with_id(
        window,
        CONTEXT_NORMALIZE_NFC_MENU_ITEM_ID,
        "파일명을 NFC로 변환",
        can_normalize_filename,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let delete = MenuItem::with_id(
        window,
        CONTEXT_DELETE_MENU_ITEM_ID,
        "삭제",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let refresh = MenuItem::with_id(
        window,
        CONTEXT_REFRESH_MENU_ITEM_ID,
        "새로고침",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let first_separator =
        PredefinedMenuItem::separator(window).map_err(|error| error.to_string())?;

    Menu::with_items(
        window,
        &[
            &info,
            &reveal,
            &terminal,
            &create_zip,
            &extract_zip,
            &paste,
            &copy_path,
            &first_separator,
            &copy,
            &move_item,
            &rename,
            &normalize_nfc,
            &delete,
            &refresh,
        ],
    )
    .map_err(|error| error.to_string())
}

fn build_background_context_menu(window: &Window) -> Result<Menu<tauri::Wry>, String> {
    let new_folder = MenuItem::with_id(
        window,
        CONTEXT_NEW_FOLDER_MENU_ITEM_ID,
        "새 폴더",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let new_file = MenuItem::with_id(
        window,
        CONTEXT_NEW_FILE_MENU_ITEM_ID,
        "새 파일",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let reveal = MenuItem::with_id(
        window,
        CONTEXT_REVEAL_MENU_ITEM_ID,
        OPEN_LOCATION_MENU_LABEL,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let terminal = MenuItem::with_id(
        window,
        CONTEXT_TERMINAL_MENU_ITEM_ID,
        "터미널에서 열기",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let copy_path = MenuItem::with_id(
        window,
        CONTEXT_COPY_PATH_MENU_ITEM_ID,
        "경로 복사",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let search = MenuItem::with_id(
        window,
        CONTEXT_SEARCH_MENU_ITEM_ID,
        "여기서 검색",
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let first_separator =
        PredefinedMenuItem::separator(window).map_err(|error| error.to_string())?;
    let second_separator =
        PredefinedMenuItem::separator(window).map_err(|error| error.to_string())?;

    Menu::with_items(
        window,
        &[
            &new_folder,
            &new_file,
            &first_separator,
            &reveal,
            &terminal,
            &copy_path,
            &second_separator,
            &search,
        ],
    )
    .map_err(|error| error.to_string())
}

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
