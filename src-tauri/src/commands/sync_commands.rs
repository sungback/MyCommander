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

#[derive(Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SyncEntryKind {
    File,
    Directory,
}

#[derive(Serialize)]
pub struct SyncItem {
    rel_path: String,
    left_path: Option<String>,
    right_path: Option<String>,
    left_kind: Option<SyncEntryKind>,
    right_kind: Option<SyncEntryKind>,
    status: SyncStatus,
}

struct FileInfo {
    path: String,
    last_modified: Option<u64>,
    size: u64,
    kind: SyncEntryKind,
}

fn is_hidden_sync_entry(file_name: &str, metadata: &fs::Metadata) -> bool {
    if file_name == "." || file_name == ".." {
        return false;
    }

    if file_name.starts_with('.') {
        return true;
    }

    #[cfg(target_os = "macos")]
    {
        use std::os::macos::fs::MetadataExt;

        const UF_HIDDEN: u32 = 0x0000_8000;
        metadata.st_flags() & UF_HIDDEN != 0
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = metadata;
        false
    }
}

fn normalize_relative_path(path: &str) -> String {
    path.replace('\\', "/").trim_matches('/').to_string()
}

fn is_descendant_relative_path(ancestor: &str, candidate: &str) -> bool {
    let normalized_ancestor = normalize_relative_path(ancestor);
    let normalized_candidate = normalize_relative_path(candidate);

    if normalized_ancestor.is_empty() || normalized_ancestor == normalized_candidate {
        return false;
    }

    normalized_candidate.starts_with(&format!("{normalized_ancestor}/"))
}

fn is_one_sided_directory(item: &SyncItem) -> bool {
    matches!(
        (&item.status, item.left_kind, item.right_kind),
        (SyncStatus::LeftOnly, Some(SyncEntryKind::Directory), None)
            | (SyncStatus::RightOnly, None, Some(SyncEntryKind::Directory))
    )
}

fn get_last_modified_millis(path: &str) -> Option<u64> {
    fs::metadata(path)
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

fn scan_directory(dir_path: &str, show_hidden: bool) -> Result<HashMap<String, FileInfo>, String> {
    let mut files = HashMap::new();
    let base_path = Path::new(dir_path);

    if !base_path.is_dir() {
        return Err(format!("{} is not a directory", dir_path));
    }

    let mut entries = WalkDir::new(dir_path).into_iter();

    while let Some(entry) = entries.next() {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();
        let abs_path_str = path.to_string_lossy().to_string();

        // Skip the base directory itself
        if path == base_path {
            continue;
        }

        let metadata = fs::metadata(&abs_path_str).map_err(|e| e.to_string())?;
        let file_name = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();

        if !show_hidden && is_hidden_sync_entry(&file_name, &metadata) {
            if entry.file_type().is_dir() {
                entries.skip_current_dir();
            }
            continue;
        }

        // Calculate relative path
        let rel_path = path
            .strip_prefix(base_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| abs_path_str.clone());

        let last_modified = get_last_modified_millis(&abs_path_str);
        let size = metadata.len();
        let kind = if entry.file_type().is_dir() {
            SyncEntryKind::Directory
        } else {
            SyncEntryKind::File
        };

        files.insert(
            rel_path,
            FileInfo {
                path: abs_path_str,
                last_modified,
                size,
                kind,
            },
        );
    }

    Ok(files)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn compare_directories(
    left: String,
    right: String,
    show_hidden: bool,
) -> Result<Vec<SyncItem>, String> {
    let left_files = scan_directory(&left, show_hidden)?;
    let right_files = scan_directory(&right, show_hidden)?;

    let mut result = Vec::new();
    let mut processed = std::collections::HashSet::new();

    // Process files from left directory
    for (rel_path, left_info) in left_files.iter() {
        processed.insert(rel_path.clone());

        if let Some(right_info) = right_files.get(rel_path) {
            if left_info.kind == SyncEntryKind::Directory
                && right_info.kind == SyncEntryKind::Directory
            {
                continue;
            }

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
                left_kind: Some(left_info.kind),
                right_kind: Some(right_info.kind),
                status,
            });
        } else {
            // File only in left
            result.push(SyncItem {
                rel_path: rel_path.clone(),
                left_path: Some(left_info.path.clone()),
                right_path: None,
                left_kind: Some(left_info.kind),
                right_kind: None,
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
                left_kind: None,
                right_kind: Some(right_info.kind),
                status: SyncStatus::RightOnly,
            });
        }
    }

    // Sort by relative path for consistent ordering
    result.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));

    let mut filtered = Vec::with_capacity(result.len());
    let mut collapsed_roots: Vec<String> = Vec::new();

    for item in result {
        if collapsed_roots
            .iter()
            .any(|ancestor| is_descendant_relative_path(ancestor, &item.rel_path))
        {
            continue;
        }

        if is_one_sided_directory(&item) {
            collapsed_roots.push(item.rel_path.clone());
        }

        filtered.push(item);
    }

    Ok(filtered)
}

#[cfg(test)]
#[path = "sync_commands_tests.rs"]
mod sync_commands_tests;
