use serde::Deserialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{LogicalPosition, Position, Window};

pub const CONTEXT_INFO_MENU_ITEM_ID: &str = "context_info";
pub const CONTEXT_REVEAL_MENU_ITEM_ID: &str = "context_reveal";
pub const CONTEXT_TERMINAL_MENU_ITEM_ID: &str = "context_terminal";
pub const CONTEXT_CALCULATE_SIZE_MENU_ITEM_ID: &str = "context_calculate_size";
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
    pub can_calculate_size: bool,
    pub can_create_zip: bool,
    pub can_extract_zip: bool,
}

#[cfg(target_os = "macos")]
const OPEN_LOCATION_MENU_LABEL: &str = "Finder 열기";
#[cfg(target_os = "windows")]
const OPEN_LOCATION_MENU_LABEL: &str = "탐색기 열기";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const OPEN_LOCATION_MENU_LABEL: &str = "위치 열기";

fn context_menu_item(
    window: &Window,
    id: &str,
    label: &str,
    enabled: bool,
) -> Result<MenuItem<tauri::Wry>, String> {
    MenuItem::with_id(window, id, label, enabled, None::<&str>).map_err(|error| error.to_string())
}

fn context_menu_separator(window: &Window) -> Result<PredefinedMenuItem<tauri::Wry>, String> {
    PredefinedMenuItem::separator(window).map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn show_context_menu(window: Window, request: ShowContextMenuRequest) -> Result<(), String> {
    let menu = if request.has_target_item {
        build_target_context_menu(
            &window,
            request.can_rename,
            request.can_normalize_filename,
            request.can_calculate_size,
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
    can_calculate_size: bool,
    can_create_zip: bool,
    can_extract_zip: bool,
) -> Result<Menu<tauri::Wry>, String> {
    let info = context_menu_item(window, CONTEXT_INFO_MENU_ITEM_ID, "속성", true)?;
    let reveal = context_menu_item(
        window,
        CONTEXT_REVEAL_MENU_ITEM_ID,
        OPEN_LOCATION_MENU_LABEL,
        true,
    )?;
    let terminal = context_menu_item(
        window,
        CONTEXT_TERMINAL_MENU_ITEM_ID,
        "터미널에서 열기",
        true,
    )?;
    let calculate_size = context_menu_item(
        window,
        CONTEXT_CALCULATE_SIZE_MENU_ITEM_ID,
        "용량 계산",
        can_calculate_size,
    )?;
    let create_zip = context_menu_item(
        window,
        CONTEXT_CREATE_ZIP_MENU_ITEM_ID,
        CONTEXT_CREATE_ZIP_MENU_LABEL,
        can_create_zip,
    )?;
    let extract_zip = context_menu_item(
        window,
        CONTEXT_EXTRACT_ZIP_MENU_ITEM_ID,
        CONTEXT_EXTRACT_ZIP_MENU_LABEL,
        can_extract_zip,
    )?;
    let paste = context_menu_item(window, CONTEXT_PASTE_MENU_ITEM_ID, "붙여넣기", false)?;
    let copy_path = context_menu_item(window, CONTEXT_COPY_PATH_MENU_ITEM_ID, "경로 복사", true)?;
    let copy = context_menu_item(window, CONTEXT_COPY_MENU_ITEM_ID, "복사", true)?;
    let move_item = context_menu_item(window, CONTEXT_MOVE_MENU_ITEM_ID, "이동", true)?;
    let rename = context_menu_item(
        window,
        CONTEXT_RENAME_MENU_ITEM_ID,
        "이름 바꾸기",
        can_rename,
    )?;
    let normalize_nfc = context_menu_item(
        window,
        CONTEXT_NORMALIZE_NFC_MENU_ITEM_ID,
        "파일명을 NFC로 변환",
        can_normalize_filename,
    )?;
    let delete = context_menu_item(window, CONTEXT_DELETE_MENU_ITEM_ID, "삭제", true)?;
    let refresh = context_menu_item(window, CONTEXT_REFRESH_MENU_ITEM_ID, "새로고침", true)?;
    let first_separator = context_menu_separator(window)?;

    Menu::with_items(
        window,
        &[
            &info,
            &reveal,
            &terminal,
            &calculate_size,
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
    let new_folder = context_menu_item(window, CONTEXT_NEW_FOLDER_MENU_ITEM_ID, "새 폴더", true)?;
    let new_file = context_menu_item(window, CONTEXT_NEW_FILE_MENU_ITEM_ID, "새 파일", true)?;
    let reveal = context_menu_item(
        window,
        CONTEXT_REVEAL_MENU_ITEM_ID,
        OPEN_LOCATION_MENU_LABEL,
        true,
    )?;
    let terminal = context_menu_item(
        window,
        CONTEXT_TERMINAL_MENU_ITEM_ID,
        "터미널에서 열기",
        true,
    )?;
    let copy_path = context_menu_item(window, CONTEXT_COPY_PATH_MENU_ITEM_ID, "경로 복사", true)?;
    let search = context_menu_item(window, CONTEXT_SEARCH_MENU_ITEM_ID, "여기서 검색", true)?;
    let calculate_size = context_menu_item(
        window,
        CONTEXT_CALCULATE_SIZE_MENU_ITEM_ID,
        "폴더 용량 계산",
        true,
    )?;
    let first_separator = context_menu_separator(window)?;
    let second_separator = context_menu_separator(window)?;

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
            &calculate_size,
            &search,
        ],
    )
    .map_err(|error| error.to_string())
}
