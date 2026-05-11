#[path = "metadata/dir_size.rs"]
mod dir_size;
#[path = "metadata/listing.rs"]
mod listing;
#[path = "metadata/preview.rs"]
mod preview;

pub use dir_size::{DirSizeScanState, DirectorySizeEstimate, DirectorySizeScanResult};
pub(crate) use listing::is_hidden_entry;
pub use listing::FileEntry;

#[cfg(test)]
pub(crate) use dir_size::compute_path_size;
#[cfg(test)]
pub(crate) use preview::{decode_preview_bytes, path_matches_denied_home_path};

#[tauri::command(rename_all = "snake_case")]
pub async fn list_directory(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    listing::list_directory(path, show_hidden).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn read_file_content(path: String) -> Result<String, String> {
    preview::read_file_content(path).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_dir_size(path: String) -> Result<u64, String> {
    dir_size::get_dir_size(path).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn estimate_dir_size(
    path: String,
    max_depth: Option<usize>,
    max_entries: Option<usize>,
) -> Result<DirectorySizeEstimate, String> {
    dir_size::estimate_dir_size(path, max_depth, max_entries).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn scan_dir_size(
    app: tauri::AppHandle,
    state: tauri::State<'_, DirSizeScanState>,
    path: String,
    scan_id: String,
) -> Result<DirectorySizeScanResult, String> {
    dir_size::scan_dir_size(app, state.inner().clone(), path, scan_id).await
}

#[tauri::command(rename_all = "snake_case")]
pub fn cancel_dir_size_scan(
    state: tauri::State<'_, DirSizeScanState>,
    scan_id: String,
) -> Result<(), String> {
    dir_size::cancel_dir_size_scan(state.inner().clone(), scan_id)
}
