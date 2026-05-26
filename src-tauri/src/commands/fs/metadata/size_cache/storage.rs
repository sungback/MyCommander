use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use super::snapshot::{empty_snapshot, parse_snapshot};
use super::{DirectorySizeCacheSnapshot, CACHE_FILE_NAME};

pub(super) fn cache_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data dir: {error}"))?;
    Ok(app_dir.join(CACHE_FILE_NAME))
}

pub(super) fn read_snapshot_from_path(
    file_path: &Path,
) -> Result<DirectorySizeCacheSnapshot, String> {
    if !file_path.exists() {
        return Ok(empty_snapshot());
    }

    let content = fs::read_to_string(file_path)
        .map_err(|error| format!("Failed to read directory size cache: {error}"))?;
    Ok(parse_snapshot(&content).unwrap_or_else(|_| empty_snapshot()))
}

pub(super) fn write_snapshot_to_path(
    file_path: &Path,
    snapshot: &DirectorySizeCacheSnapshot,
) -> Result<(), String> {
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create directory size cache dir: {error}"))?;
    }

    let content = serde_json::to_string_pretty(snapshot)
        .map_err(|error| format!("Failed to encode directory size cache: {error}"))?;
    let temp_path = file_path.with_extension("json.tmp");
    fs::write(&temp_path, content)
        .map_err(|error| format!("Failed to write directory size cache temp file: {error}"))?;

    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|error| format!("Failed to replace directory size cache: {error}"))?;
    }

    fs::rename(&temp_path, file_path)
        .map_err(|error| format!("Failed to finalize directory size cache: {error}"))
}
