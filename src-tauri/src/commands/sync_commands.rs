use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub enum SyncStatus {
    LeftOnly,
    RightOnly,
    LeftNewer,
    RightNewer,
    Same,
}

#[derive(Serialize)]
pub struct SyncItem {
    rel_path: String,
    left_path: Option<String>,
    right_path: Option<String>,
    status: SyncStatus,
}

struct FileInfo {
    path: String,
    last_modified: Option<u64>,
    size: u64,
}

fn get_last_modified_millis(path: &str) -> Option<u64> {
    fs::metadata(path)
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

fn scan_directory(dir_path: &str) -> Result<HashMap<String, FileInfo>, String> {
    let mut files = HashMap::new();
    let base_path = Path::new(dir_path);

    if !base_path.is_dir() {
        return Err(format!("{} is not a directory", dir_path));
    }

    for entry in WalkDir::new(dir_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let abs_path_str = path.to_string_lossy().to_string();

        // Skip the base directory itself
        if path == base_path {
            continue;
        }

        // Calculate relative path
        let rel_path = path
            .strip_prefix(base_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| abs_path_str.clone());

        let metadata = fs::metadata(&abs_path_str).ok();
        let last_modified = get_last_modified_millis(&abs_path_str);
        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

        files.insert(
            rel_path,
            FileInfo {
                path: abs_path_str,
                last_modified,
                size,
            },
        );
    }

    Ok(files)
}

#[tauri::command]
pub async fn compare_directories(left: String, right: String) -> Result<Vec<SyncItem>, String> {
    let left_files = scan_directory(&left)?;
    let right_files = scan_directory(&right)?;

    let mut result = Vec::new();
    let mut processed = std::collections::HashSet::new();

    // Process files from left directory
    for (rel_path, left_info) in left_files.iter() {
        processed.insert(rel_path.clone());

        if let Some(right_info) = right_files.get(rel_path) {
            // File exists in both directories
            let status = if left_info.last_modified == right_info.last_modified
                && left_info.size == right_info.size
            {
                SyncStatus::Same
            } else {
                match (left_info.last_modified, right_info.last_modified) {
                    (Some(l_time), Some(r_time)) => {
                        if l_time > r_time {
                            SyncStatus::LeftNewer
                        } else {
                            SyncStatus::RightNewer
                        }
                    }
                    (Some(_), None) => SyncStatus::LeftNewer,
                    (None, Some(_)) => SyncStatus::RightNewer,
                    (None, None) => SyncStatus::Same,
                }
            };

            result.push(SyncItem {
                rel_path: rel_path.clone(),
                left_path: Some(left_info.path.clone()),
                right_path: Some(right_info.path.clone()),
                status,
            });
        } else {
            // File only in left
            result.push(SyncItem {
                rel_path: rel_path.clone(),
                left_path: Some(left_info.path.clone()),
                right_path: None,
                status: SyncStatus::LeftOnly,
            });
        }
    }

    // Process files only in right directory
    for (rel_path, right_info) in right_files.iter() {
        if !processed.contains(rel_path) {
            result.push(SyncItem {
                rel_path: rel_path.clone(),
                left_path: None,
                right_path: Some(right_info.path.clone()),
                status: SyncStatus::RightOnly,
            });
        }
    }

    // Sort by relative path for consistent ordering
    result.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));

    Ok(result)
}
