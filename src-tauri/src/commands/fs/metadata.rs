#[path = "metadata/dir_size.rs"]
mod dir_size;
#[path = "metadata/listing.rs"]
mod listing;
#[path = "metadata/preview.rs"]
mod preview;

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
