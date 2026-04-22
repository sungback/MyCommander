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
        return metadata.st_flags() & UF_HIDDEN != 0;
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
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_TEST_ID: AtomicU64 = AtomicU64::new(1);

    fn unique_temp_dir(prefix: &str) -> PathBuf {
        let id = NEXT_TEST_ID.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!(
            "mycommander-sync-tests-{prefix}-{}-{id}",
            std::process::id()
        ));
        if dir.exists() {
            let _ = fs::remove_dir_all(&dir);
        }
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn compare_directories_skips_shared_directory_metadata_noise() {
        let left = unique_temp_dir("left");
        let right = unique_temp_dir("right");

        fs::create_dir_all(left.join("docs")).expect("create left docs");
        fs::create_dir_all(right.join("docs")).expect("create right docs");
        fs::write(left.join("docs/report.md"), "left").expect("write left file");
        fs::write(right.join("docs/report.md"), "right").expect("write right file");

        let runtime = tokio::runtime::Runtime::new().expect("create runtime");
        let items = runtime
            .block_on(compare_directories(
                left.to_string_lossy().to_string(),
                right.to_string_lossy().to_string(),
                false,
            ))
            .expect("compare directories");

        assert!(
            items.iter().all(|item| item.rel_path != "docs"),
            "shared directories should not appear as actionable sync rows: {:?}",
            items
                .iter()
                .map(|item| item.rel_path.clone())
                .collect::<Vec<_>>()
        );
        assert!(
            items.iter().any(|item| item.rel_path == "docs/report.md"),
            "changed nested files should still be reported"
        );

        fs::remove_dir_all(left).expect("cleanup left");
        fs::remove_dir_all(right).expect("cleanup right");
    }

    #[test]
    fn compare_directories_accepts_snake_case_invoke_args() {
        let left = unique_temp_dir("invoke-left");
        let right = unique_temp_dir("invoke-right");

        let app = tauri::test::mock_builder()
            .invoke_handler(tauri::generate_handler![compare_directories])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("build test app");
        let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("build test webview");

        let response = tauri::test::get_ipc_response(
            &webview,
            tauri::webview::InvokeRequest {
                cmd: "compare_directories".into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: "http://tauri.localhost".parse().expect("parse invoke url"),
                body: tauri::ipc::InvokeBody::from(serde_json::json!({
                    "left": left.to_string_lossy().to_string(),
                    "right": right.to_string_lossy().to_string(),
                    "show_hidden": false,
                })),
                headers: Default::default(),
                invoke_key: tauri::test::INVOKE_KEY.to_string(),
            },
        );

        assert!(
            response.is_ok(),
            "snake_case invoke payload should be accepted: {response:?}"
        );

        fs::remove_dir_all(left).expect("cleanup left");
        fs::remove_dir_all(right).expect("cleanup right");
    }

    #[test]
    fn compare_directories_hides_hidden_entries_and_descendants_by_default() {
        let left = unique_temp_dir("hidden-left");
        let right = unique_temp_dir("hidden-right");

        fs::create_dir_all(left.join(".claude/worktrees")).expect("create hidden left dir");
        fs::write(left.join(".claude/settings.local.json"), "{}").expect("write hidden config");
        fs::write(left.join(".claude/worktrees/trace.txt"), "secret").expect("write hidden child");
        fs::write(left.join(".DS_Store"), "mac").expect("write ds_store");
        fs::write(left.join("visible.txt"), "visible").expect("write visible file");

        let runtime = tokio::runtime::Runtime::new().expect("create runtime");
        let items = runtime
            .block_on(compare_directories(
                left.to_string_lossy().to_string(),
                right.to_string_lossy().to_string(),
                false,
            ))
            .expect("compare directories");

        let rel_paths = items
            .iter()
            .map(|item| item.rel_path.clone())
            .collect::<Vec<_>>();
        assert_eq!(rel_paths, vec!["visible.txt"]);

        fs::remove_dir_all(left).expect("cleanup left");
        fs::remove_dir_all(right).expect("cleanup right");
    }

    #[test]
    fn compare_directories_collapses_descendants_under_one_sided_directory() {
        let left = unique_temp_dir("collapse-left");
        let right = unique_temp_dir("collapse-right");

        fs::create_dir_all(left.join("docs/nested")).expect("create left docs tree");
        fs::write(left.join("docs/report.md"), "left").expect("write left file");
        fs::write(left.join("docs/nested/a.txt"), "nested").expect("write nested file");

        let runtime = tokio::runtime::Runtime::new().expect("create runtime");
        let items = runtime
            .block_on(compare_directories(
                left.to_string_lossy().to_string(),
                right.to_string_lossy().to_string(),
                false,
            ))
            .expect("compare directories");

        let rel_paths = items
            .iter()
            .map(|item| item.rel_path.clone())
            .collect::<Vec<_>>();
        assert_eq!(rel_paths, vec!["docs"]);

        fs::remove_dir_all(left).expect("cleanup left");
        fs::remove_dir_all(right).expect("cleanup right");
    }
}
