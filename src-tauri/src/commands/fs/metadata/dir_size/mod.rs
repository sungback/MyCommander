mod compute;
mod scan;
mod shared_scan;
mod types;

#[cfg(test)]
pub(crate) use compute::compute_path_size;
pub use shared_scan::DirSizeScanState;
pub use types::{DirectorySizeEstimate, DirectorySizeProgress, DirectorySizeScanResult};

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
    shared_scan::run_shared_scan(
        state,
        path,
        scan_id,
        |path, cancel_flag, emit_progress| {
            scan::scan_path_size_with_progress(path, cancel_flag, emit_progress)
        },
        move |scan_id, path, progress| {
            let _ = app.emit(
                "dir-size-progress",
                DirectorySizeProgress {
                    scan_id: scan_id.to_string(),
                    path: path.to_string(),
                    size: progress.size,
                    is_partial: progress.is_partial,
                    scanned_entries: progress.scanned_entries,
                    completed: progress.completed,
                },
            );
        },
    )
    .await
}

pub fn cancel_dir_size_scan(state: DirSizeScanState, scan_id: String) -> Result<(), String> {
    state.cancel(&scan_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::compute::compute_path_size;
    use super::compute::estimate_path_size;
    use super::scan::scan_path_size_with_progress;
    #[cfg(unix)]
    use super::scan::VolumeBoundary;
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::symlink;
    use std::sync::atomic::AtomicBool;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[cfg(unix)]
    #[test]
    fn sparse_file_counts_allocated_size_not_apparent_size() {
        let root = make_temp_dir("sparse-file");
        let sparse = root.join("disk.img.raw");
        let file = fs::File::create(&sparse).unwrap();
        // 실제 데이터 없이 논리 크기만 4GiB로 늘린다.
        file.set_len(4 * 1024 * 1024 * 1024).unwrap();
        drop(file);
        fs::write(root.join("small.txt"), [1_u8; 10]).unwrap();

        let cancel = AtomicBool::new(false);
        let scanned =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel, |_| {}).unwrap();
        let estimate = estimate_path_size(root.to_str().unwrap(), 1, 100).unwrap();

        assert!(
            scanned.size < 1024 * 1024 * 1024,
            "scan size {}",
            scanned.size
        );
        assert!(
            estimate.size < 1024 * 1024 * 1024,
            "estimate size {}",
            estimate.size
        );

        fs::remove_dir_all(root).unwrap();
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
    fn scan_path_size_uses_same_basis_for_app_bundles_and_plain_folders() {
        let root = make_temp_dir("scan-app-bundle");
        let make_tree = |dir: &std::path::Path| {
            let resources = dir.join("Contents").join("Resources");
            fs::create_dir_all(&resources).unwrap();
            fs::write(resources.join("icon.icns"), [1_u8; 1234]).unwrap();
            fs::File::create(resources.join("sparse.bin"))
                .unwrap()
                .set_len(8 * 1024 * 1024)
                .unwrap();
        };
        let app_bundle = root.join("Example.app");
        let plain = root.join("Example");
        make_tree(&app_bundle);
        make_tree(&plain);
        let cancel_flag = AtomicBool::new(false);

        let app_result =
            scan_path_size_with_progress(app_bundle.to_str().unwrap(), &cancel_flag, |_| {})
                .unwrap();
        let plain_result =
            scan_path_size_with_progress(plain.to_str().unwrap(), &cancel_flag, |_| {}).unwrap();

        // .app도 du(할당 크기) 대신 다른 폴더와 같은 겉보기 크기 기준을 쓴다.
        assert_eq!(app_result.size, 1234 + 8 * 1024 * 1024);
        assert_eq!(app_result.size, plain_result.size);
        assert_eq!(app_result.scanned_entries, plain_result.scanned_entries);
        assert!(!app_result.is_partial);

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

    #[cfg(unix)]
    #[test]
    fn scan_path_size_counts_hard_linked_files_once() {
        let root = make_temp_dir("scan-hardlink");
        let original = root.join("original.bin");
        fs::write(&original, [1_u8; 100]).unwrap();
        fs::hard_link(&original, root.join("link-a.bin")).unwrap();
        fs::create_dir_all(root.join("nested")).unwrap();
        fs::hard_link(&original, root.join("nested").join("link-b.bin")).unwrap();
        fs::write(root.join("other.bin"), [1_u8; 10]).unwrap();
        let cancel_flag = AtomicBool::new(false);

        let result =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {}).unwrap();

        assert_eq!(result.size, 110);

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn compute_path_size_matches_scan_and_counts_hard_links_once() {
        let root = make_temp_dir("compute-hardlink");
        let original = root.join("original.bin");
        fs::write(&original, vec![1_u8; 8192]).unwrap();
        fs::hard_link(&original, root.join("link.bin")).unwrap();
        fs::write(root.join("small.bin"), [1_u8; 10]).unwrap();
        let cancel_flag = AtomicBool::new(false);

        let computed = compute_path_size(root.to_str().unwrap()).unwrap();
        let scanned = scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {})
            .unwrap()
            .size;

        assert_eq!(computed, 8202);
        assert_eq!(computed, scanned);

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn estimate_path_size_counts_hard_linked_files_once() {
        let root = make_temp_dir("estimate-hardlink");
        let original = root.join("original.bin");
        fs::write(&original, [1_u8; 100]).unwrap();
        fs::hard_link(&original, root.join("link-a.bin")).unwrap();

        let estimate = estimate_path_size(root.to_str().unwrap(), 1, 100).unwrap();

        assert_eq!(estimate.size, 100);

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn scan_path_size_counts_unreadable_directories_without_marking_partial() {
        use std::os::unix::fs::PermissionsExt;

        let root = make_temp_dir("scan-permission");
        let locked = root.join("locked");
        fs::create_dir_all(&locked).unwrap();
        fs::write(locked.join("hidden.bin"), [1_u8; 50]).unwrap();
        fs::write(root.join("visible.bin"), [1_u8; 10]).unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
        let cancel_flag = AtomicBool::new(false);

        if fs::read_dir(&locked).is_ok() {
            // root 권한에서는 권한 비트가 무시되어 재현할 수 없다.
            fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
            fs::remove_dir_all(&root).unwrap();
            return;
        }

        let result = scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {});

        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        fs::remove_dir_all(&root).unwrap();
        let result = result.unwrap();
        assert_eq!(result.size, 10);
        assert!(!result.is_partial);
        assert_eq!(result.error_count, 0);
        assert_eq!(result.inaccessible_count, 1);
    }

    #[cfg(unix)]
    #[test]
    fn scan_path_size_counts_unreadable_root_as_inaccessible() {
        use std::os::unix::fs::PermissionsExt;

        let root = make_temp_dir("scan-permission-root");
        fs::write(root.join("hidden.bin"), [1_u8; 50]).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o000)).unwrap();
        let cancel_flag = AtomicBool::new(false);

        if fs::read_dir(&root).is_ok() {
            // root 권한에서는 권한 비트가 무시되어 재현할 수 없다.
            fs::set_permissions(&root, fs::Permissions::from_mode(0o755)).unwrap();
            fs::remove_dir_all(&root).unwrap();
            return;
        }

        let result = scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {});

        fs::set_permissions(&root, fs::Permissions::from_mode(0o755)).unwrap();
        fs::remove_dir_all(&root).unwrap();
        let result = result.unwrap();
        assert_eq!(result.size, 0);
        assert!(!result.is_partial);
        assert_eq!(result.inaccessible_count, 1);
    }

    #[test]
    fn scan_path_size_reports_zero_inaccessible_for_readable_tree() {
        let root = make_temp_dir("scan-readable");
        fs::write(root.join("file.bin"), [1_u8; 10]).unwrap();
        let cancel_flag = AtomicBool::new(false);
        let before_ms = unix_ms();

        let result =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {}).unwrap();

        assert_eq!(result.inaccessible_count, 0);
        assert!(result.started_at_ms >= before_ms && result.started_at_ms <= unix_ms());

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn volume_boundary_rejects_other_devices() {
        let root = make_temp_dir("volume-boundary");
        fs::write(root.join("file.bin"), [1_u8; 10]).unwrap();
        let root_metadata = fs::symlink_metadata(&root).unwrap();
        let boundary = VolumeBoundary::new(&root_metadata);
        // /dev는 macOS(devfs)와 Linux(devtmpfs) 모두 별도 파일시스템이다.
        let other_device = fs::symlink_metadata("/dev").unwrap();

        assert!(boundary.contains(&fs::symlink_metadata(root.join("file.bin")).unwrap()));
        assert!(!boundary.contains(&other_device));

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn compute_path_size_does_not_follow_symlinks() {
        let root = make_temp_dir("compute-symlink");
        let target_file = root.join("target.bin");
        let target_dir = root.join("target-dir");
        fs::write(&target_file, [1_u8; 100]).unwrap();
        fs::create_dir_all(&target_dir).unwrap();
        fs::write(target_dir.join("inner.bin"), [1_u8; 200]).unwrap();
        symlink(&target_file, root.join("file-link")).unwrap();
        symlink(&target_dir, root.join("dir-link")).unwrap();
        symlink(root.join("missing"), root.join("dangling-link")).unwrap();

        let file_link = compute_path_size(root.join("file-link").to_str().unwrap());
        let dir_link = compute_path_size(root.join("dir-link").to_str().unwrap());
        let dangling_link = compute_path_size(root.join("dangling-link").to_str().unwrap());

        assert_eq!(file_link, Ok(0));
        assert_eq!(dir_link, Ok(0));
        assert_eq!(dangling_link, Ok(0));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn compute_path_size_reports_missing_path() {
        let result = compute_path_size("/nonexistent/mycommander/size/path");

        assert_eq!(
            result.unwrap_err(),
            "/nonexistent/mycommander/size/path does not exist"
        );
    }

    fn unix_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
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
