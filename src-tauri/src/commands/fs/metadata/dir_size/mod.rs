mod compute;
mod scan;
mod types;

#[cfg(test)]
pub(crate) use compute::compute_path_size;
pub use types::{
    DirSizeScanState, DirectorySizeEstimate, DirectorySizeProgress, DirectorySizeScanResult,
};

use compute::{DEFAULT_ESTIMATE_MAX_DEPTH, DEFAULT_ESTIMATE_MAX_ENTRIES};
use tauri::{AppHandle, Emitter};

pub async fn get_dir_size(path: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || compute::compute_path_size(&path))
        .await
        .map_err(|e| e.to_string())?
}

pub async fn estimate_dir_size(
    path: String,
    max_depth: Option<usize>,
    max_entries: Option<usize>,
) -> Result<DirectorySizeEstimate, String> {
    tokio::task::spawn_blocking(move || {
        compute::estimate_path_size(
            &path,
            max_depth.unwrap_or(DEFAULT_ESTIMATE_MAX_DEPTH),
            max_entries.unwrap_or(DEFAULT_ESTIMATE_MAX_ENTRIES),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

pub async fn scan_dir_size(
    app: AppHandle,
    state: DirSizeScanState,
    path: String,
    scan_id: String,
) -> Result<DirectorySizeScanResult, String> {
    let cancel_flag = state.begin(&scan_id)?;
    let scan_result = tokio::task::spawn_blocking({
        let cancel_flag = cancel_flag.clone();
        let path = path.clone();
        let scan_id = scan_id.clone();
        move || {
            scan::scan_path_size_with_progress(&path, &cancel_flag, |progress| {
                let _ = app.emit(
                    "dir-size-progress",
                    DirectorySizeProgress {
                        scan_id: scan_id.clone(),
                        path: path.clone(),
                        size: progress.size,
                        is_partial: progress.is_partial,
                        scanned_entries: progress.scanned_entries,
                        completed: progress.completed,
                    },
                );
            })
        }
    })
    .await;

    state.end(&scan_id);
    scan_result.map_err(|e| e.to_string())?
}

pub fn cancel_dir_size_scan(state: DirSizeScanState, scan_id: String) -> Result<(), String> {
    state.cancel(&scan_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    use super::compute::du_size_command_args;
    use super::compute::estimate_path_size;
    #[cfg(unix)]
    use super::compute::is_same_filesystem_device;
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    use super::compute::parse_du_size_bytes;
    use super::scan::scan_path_size_with_progress;
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::symlink;
    use std::sync::atomic::AtomicBool;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn parse_du_size_bytes_reads_summary_even_with_other_output() {
        assert_eq!(parse_du_size_bytes("42\t/Users/example\n"), Some(43_008));
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn parse_du_size_bytes_returns_none_for_unparseable_output() {
        assert_eq!(parse_du_size_bytes(""), None);
        assert_eq!(parse_du_size_bytes("du: cannot read directory"), None);
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn du_size_command_stays_on_current_filesystem() {
        assert_eq!(du_size_command_args("/System"), ["-skx", "/System"]);
    }

    #[cfg(unix)]
    #[test]
    fn filesystem_boundary_check_rejects_different_devices() {
        assert!(is_same_filesystem_device(Some(7), 7));
        assert!(!is_same_filesystem_device(Some(7), 8));
        assert!(is_same_filesystem_device(None, 8));
    }

    #[test]
    fn estimate_path_size_reads_files_within_depth_limit() {
        let root = make_temp_dir("estimate-depth");
        let child = root.join("child");
        fs::create_dir_all(&child).unwrap();
        fs::write(root.join("root.bin"), [1_u8; 10]).unwrap();
        fs::write(child.join("child.bin"), [1_u8; 20]).unwrap();

        let estimate = estimate_path_size(root.to_str().unwrap(), 1, 100).unwrap();

        assert_eq!(estimate.size, 30);
        assert!(!estimate.is_partial);
        assert_eq!(estimate.scanned_entries, 3);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn estimate_path_size_marks_unscanned_children_partial() {
        let root = make_temp_dir("estimate-partial");
        let child = root.join("child");
        fs::create_dir_all(&child).unwrap();
        fs::write(child.join("child.bin"), [1_u8; 20]).unwrap();

        let estimate = estimate_path_size(root.to_str().unwrap(), 0, 100).unwrap();

        assert_eq!(estimate.size, 0);
        assert!(estimate.is_partial);
        assert_eq!(estimate.scanned_entries, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn estimate_path_size_marks_entry_limit_partial() {
        let root = make_temp_dir("estimate-limit");
        fs::write(root.join("a.bin"), [1_u8; 10]).unwrap();
        fs::write(root.join("b.bin"), [1_u8; 20]).unwrap();

        let estimate = estimate_path_size(root.to_str().unwrap(), 1, 1).unwrap();

        assert!(estimate.is_partial);
        assert_eq!(estimate.scanned_entries, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_path_size_with_progress_reports_nested_exact_size() {
        let root = make_temp_dir("scan-exact");
        let child = root.join("child");
        fs::create_dir_all(&child).unwrap();
        fs::write(root.join("root.bin"), [1_u8; 10]).unwrap();
        fs::write(child.join("child.bin"), [1_u8; 20]).unwrap();
        let cancel_flag = AtomicBool::new(false);
        let mut progress_events = Vec::new();

        let result =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |progress| {
                progress_events.push(progress);
            })
            .unwrap();

        assert_eq!(result.size, 30);
        assert!(!result.is_partial);
        assert_eq!(result.error_count, 0);
        assert!(progress_events.last().is_some_and(|event| event.completed));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_path_size_with_progress_can_be_cancelled() {
        let root = make_temp_dir("scan-cancel");
        fs::write(root.join("file.bin"), [1_u8; 10]).unwrap();
        let cancel_flag = AtomicBool::new(true);

        let result = scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {});

        assert_eq!(result.unwrap_err(), "Directory size scan cancelled");

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn scan_path_size_skips_symlinked_directories_without_marking_partial() {
        let root = make_temp_dir("scan-symlink-dir");
        let outside = make_temp_dir("scan-symlink-outside");
        fs::write(outside.join("outside.bin"), [1_u8; 99]).unwrap();
        fs::write(root.join("inside.bin"), [1_u8; 10]).unwrap();
        symlink(&outside, root.join("linked-outside")).unwrap();
        let cancel_flag = AtomicBool::new(false);

        let result =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {}).unwrap();

        assert_eq!(result.size, 10);
        assert!(!result.is_partial);
        assert_eq!(result.error_count, 0);

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn estimate_path_size_marks_symlinked_directories_partial_without_following() {
        let root = make_temp_dir("estimate-symlink-dir");
        let outside = make_temp_dir("estimate-symlink-outside");
        fs::write(outside.join("outside.bin"), [1_u8; 99]).unwrap();
        fs::write(root.join("inside.bin"), [1_u8; 10]).unwrap();
        symlink(&outside, root.join("linked-outside")).unwrap();

        let estimate = estimate_path_size(root.to_str().unwrap(), 4, 100).unwrap();

        assert_eq!(estimate.size, 10);
        assert!(estimate.is_partial);

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    fn make_temp_dir(label: &str) -> std::path::PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("mycommander-{label}-{id}"));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
