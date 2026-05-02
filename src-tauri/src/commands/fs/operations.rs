pub(crate) mod copy;
pub(crate) mod delete;
pub(crate) mod move_ops;
mod path_utils;
pub(crate) mod rename;

use std::fs;

pub(crate) use copy::copy_files_with_cancel_and_progress;
#[cfg(test)]
pub(crate) use copy::{collect_copy_conflicts, copy_path_to_destination};
pub(crate) use delete::delete_files_with_cancel_and_progress;
#[cfg(test)]
pub(crate) use delete::{collapse_nested_paths, collect_delete_progress_targets};
pub(crate) use move_ops::move_files_with_cancel_and_progress;
#[cfg(test)]
pub(crate) use move_ops::move_path_to_destination_with_rename;
#[cfg(test)]
pub(crate) use rename::{apply_batch_rename_operations, BatchRenameOperation};
#[cfg(test)]
pub(crate) use rename::{create_file, rename_file};

#[tauri::command(rename_all = "snake_case")]
pub async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
#[path = "operations_tests.rs"]
mod operations_tests;
