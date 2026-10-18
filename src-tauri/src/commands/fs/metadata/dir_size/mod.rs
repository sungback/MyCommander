#[cfg(test)]
mod bench;
#[cfg(target_os = "macos")]
mod bulk_listing;
mod compute;
mod scan;
mod shared_scan;
mod types;

pub use shared_scan::DirSizeScanState;
pub use types::{DirectorySizeEstimate, DirectorySizeProgress, DirectorySizeScanResult};

use compute::{DEFAULT_ESTIMATE_MAX_DEPTH, DEFAULT_ESTIMATE_MAX_ENTRIES};
use tauri::{AppHandle, Emitter};

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
    use super::compute::estimate_path_size;
    #[cfg(target_os = "windows")]
    use super::scan::is_windows_unc_path;
    #[cfg(unix)]
    use super::scan::VolumeBoundary;
    use super::scan::{
        build_scan_pool, is_data_volume_mirror, scan_path_size_with_pool,
        scan_path_size_with_progress, select_recorded_children,
    };
    #[cfg(target_os = "macos")]
    use super::scan::{
        default_scan_threads, filesystem_type_name, is_network_filesystem,
        is_network_filesystem_type, scan_path_size_with_listing, DirectoryListing,
    };
    use super::types::DirectorySizeChild;
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

    #[test]
    fn data_volume_mirror_is_detected_only_on_macos() {
        assert_eq!(
            is_data_volume_mirror(std::path::Path::new("/System/Volumes/Data")),
            cfg!(target_os = "macos")
        );
        assert!(!is_data_volume_mirror(std::path::Path::new(
            "/System/Volumes/Data/Users"
        )));
        assert!(!is_data_volume_mirror(std::path::Path::new("/System")));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn estimate_path_size_does_not_descend_into_data_volume_mirror() {
        // /System/Volumes 아래에는 다른 볼륨(Preboot, VM 등)과 데이터 볼륨 firmlink만 있다.
        // firmlink로 내려가면 데이터 볼륨의 파일 수천 개를 읽어 항목 한도에 걸린다.
        let estimate = estimate_path_size("/System/Volumes", 2, 5_000).unwrap();

        assert!(
            estimate.scanned_entries < 100,
            "{}",
            estimate.scanned_entries
        );
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
    fn scan_path_size_does_not_follow_symlinked_roots() {
        let root = make_temp_dir("scan-symlink-root");
        let target_file = root.join("target.bin");
        let target_dir = root.join("target-dir");
        fs::write(&target_file, [1_u8; 100]).unwrap();
        fs::create_dir_all(&target_dir).unwrap();
        fs::write(target_dir.join("inner.bin"), [1_u8; 200]).unwrap();
        symlink(&target_file, root.join("file-link")).unwrap();
        symlink(&target_dir, root.join("dir-link")).unwrap();
        symlink(root.join("missing"), root.join("dangling-link")).unwrap();
        let cancel_flag = AtomicBool::new(false);

        for link in ["file-link", "dir-link", "dangling-link"] {
            let result = scan_path_size_with_progress(
                root.join(link).to_str().unwrap(),
                &cancel_flag,
                |_| {},
            )
            .unwrap();

            assert_eq!(result.size, 0, "{link}");
            assert!(result.is_partial, "{link}");
        }

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_path_size_reports_missing_path() {
        let cancel_flag = AtomicBool::new(false);

        let result = scan_path_size_with_progress(
            "/nonexistent/mycommander/size/path",
            &cancel_flag,
            |_| {},
        );

        assert!(result.is_err());
    }

    /// 병렬 스캐너 결과에서 시작 시각만 뺀 비교용 값.
    fn comparable(result: &super::DirectorySizeScanResult) -> (u64, bool, usize, usize, usize) {
        (
            result.size,
            result.is_partial,
            result.scanned_entries,
            result.error_count,
            result.inaccessible_count,
        )
    }

    #[cfg(unix)]
    #[test]
    fn recorded_children_match_standalone_scans() {
        use std::os::unix::fs::PermissionsExt;

        let root = make_temp_dir("children-standalone");
        let outside = make_temp_dir("children-standalone-outside");
        fs::write(outside.join("outside.bin"), [1_u8; 999]).unwrap();
        let alpha = root.join("alpha");
        let beta = root.join("beta");
        let deep = alpha.join("deep");
        let deeper = deep.join("deeper");
        fs::create_dir_all(&deeper).unwrap();
        fs::create_dir_all(&beta).unwrap();
        fs::write(alpha.join("a.bin"), [1_u8; 100]).unwrap();
        fs::write(deep.join("d.bin"), [1_u8; 30]).unwrap();
        fs::write(deeper.join("x.bin"), [1_u8; 7]).unwrap();
        fs::write(beta.join("b.bin"), [1_u8; 20]).unwrap();
        // 형제 폴더가 공유하는 하드링크는 각 폴더 합계에 한 번씩 들어간다.
        let shared = alpha.join("shared.bin");
        fs::write(&shared, [1_u8; 500]).unwrap();
        fs::hard_link(&shared, beta.join("shared-link.bin")).unwrap();
        symlink(&outside, root.join("linked-outside")).unwrap();
        let locked = root.join("locked");
        fs::create_dir_all(&locked).unwrap();
        fs::write(locked.join("hidden.bin"), [1_u8; 50]).unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
        let cancel_flag = AtomicBool::new(false);

        let result = scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {});
        let standalone = |path: &std::path::Path| {
            scan_path_size_with_progress(path.to_str().unwrap(), &cancel_flag, |_| {}).unwrap()
        };
        let expected: Vec<_> = [&alpha, &beta, &deep, &locked]
            .iter()
            .map(|path| (path.to_str().unwrap().to_string(), standalone(path)))
            .collect();

        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        fs::remove_dir_all(&root).unwrap();
        fs::remove_dir_all(&outside).unwrap();
        let result = result.unwrap();

        // 심볼릭 링크와 깊이 3 이상(deeper)은 기록하지 않는다.
        let mut recorded: Vec<_> = result
            .children
            .iter()
            .map(|child| child.path.clone())
            .collect();
        recorded.sort();
        let mut expected_paths: Vec<_> = expected.iter().map(|(path, _)| path.clone()).collect();
        expected_paths.sort();
        assert_eq!(recorded, expected_paths);

        for (path, alone) in &expected {
            let child = result
                .children
                .iter()
                .find(|child| &child.path == path)
                .unwrap();
            assert_eq!(child.size, alone.size, "{path}");
            assert_eq!(child.is_partial, alone.is_partial, "{path}");
            assert_eq!(child.inaccessible_count, alone.inaccessible_count, "{path}");
        }
        let depth_of = |path: &std::path::Path| {
            result
                .children
                .iter()
                .find(|child| child.path == path.to_str().unwrap())
                .unwrap()
                .depth
        };
        assert_eq!(depth_of(&alpha), 1);
        assert_eq!(depth_of(&deep), 2);
        assert_eq!(result.size, 100 + 30 + 7 + 20 + 500);
        assert_eq!(result.inaccessible_count, 1);
    }

    #[test]
    fn recorded_children_keep_largest_within_cap() {
        let child = |path: &str, size: u64| DirectorySizeChild {
            path: path.to_string(),
            size,
            is_partial: false,
            inaccessible_count: 0,
            depth: 1,
        };

        let selected =
            select_recorded_children(vec![child("/a", 10), child("/b", 30), child("/c", 20)], 2);

        let paths: Vec<_> = selected.iter().map(|child| child.path.as_str()).collect();
        assert_eq!(paths, vec!["/b", "/c"]);
    }

    #[test]
    fn file_scan_reports_no_children() {
        let root = make_temp_dir("children-file");
        let file = root.join("file.bin");
        fs::write(&file, [1_u8; 10]).unwrap();
        let cancel_flag = AtomicBool::new(false);

        let result =
            scan_path_size_with_progress(file.to_str().unwrap(), &cancel_flag, |_| {}).unwrap();

        assert!(result.children.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn parallel_scan_counts_hard_links_spread_across_workers_once() {
        let root = make_temp_dir("parallel-hardlinks");
        let original = root.join("original.bin");
        fs::write(&original, vec![1_u8; 10_000]).unwrap();
        for dir in 0..32 {
            let dir_path = root.join(format!("dir-{dir:02}"));
            fs::create_dir_all(&dir_path).unwrap();
            for link in 0..4 {
                fs::hard_link(&original, dir_path.join(format!("link-{link}.bin"))).unwrap();
            }
        }
        let cancel_flag = AtomicBool::new(false);
        let mut max_progress = 0;

        let result =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |progress| {
                max_progress = max_progress.max(progress.size);
            })
            .unwrap();

        assert_eq!(result.size, 10_000);
        // 진행값은 중복 제거 전 하드링크를 넣지 않으므로 최종값을 넘지 않는다.
        assert!(max_progress <= result.size);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn parallel_scan_handles_deeply_nested_directories() {
        let root = make_temp_dir("parallel-deep");
        let mut deepest = root.clone();
        for _ in 0..400 {
            deepest.push("d");
        }
        fs::create_dir_all(&deepest).unwrap();
        fs::write(deepest.join("leaf.bin"), [1_u8; 7]).unwrap();
        let cancel_flag = AtomicBool::new(false);

        let result =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {}).unwrap();

        assert_eq!(result.size, 7);
        assert_eq!(result.scanned_entries, 401);
        assert!(!result.is_partial);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn single_thread_pool_matches_default_pool() {
        let root = make_temp_dir("parallel-single-pool");
        for dir in 0..5 {
            let dir_path = root.join(format!("dir-{dir}"));
            fs::create_dir_all(&dir_path).unwrap();
            fs::write(dir_path.join("file.bin"), vec![1_u8; dir * 10 + 1]).unwrap();
        }
        let cancel_flag = AtomicBool::new(false);
        let single = build_scan_pool(1).unwrap();

        let default =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {}).unwrap();
        let single =
            scan_path_size_with_pool(root.to_str().unwrap(), &cancel_flag, |_| {}, Some(&single))
                .unwrap();

        assert_eq!(comparable(&default), comparable(&single));
        assert_eq!(default.size, 1 + 11 + 21 + 31 + 41);

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn network_filesystem_detection_reads_local_root_as_local() {
        assert_eq!(
            filesystem_type_name(std::path::Path::new("/")).as_deref(),
            Some("apfs")
        );
        assert!(!is_network_filesystem(std::path::Path::new("/")));
        assert!(is_network_filesystem_type("smbfs"));
        assert!(is_network_filesystem_type("nfs"));
        assert!(is_network_filesystem_type("webdav"));
        assert!(!is_network_filesystem_type("apfs"));
        assert!(!is_network_filesystem_type("hfs"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_unc_paths_are_treated_as_network() {
        assert!(is_windows_unc_path(r"\\server\share\dir"));
        assert!(is_windows_unc_path(r"\\?\UNC\server\share"));
        assert!(!is_windows_unc_path(r"\\?\C:\Users"));
        assert!(!is_windows_unc_path(r"C:\Users"));
    }

    /// macOS 기본(getattrlistbulk)과 `read_dir` 방식이 같은 결과를 내는지 여러 경우가 섞인 트리로 비교한다.
    #[cfg(target_os = "macos")]
    #[test]
    fn bulk_listing_matches_std_listing() {
        use std::os::unix::fs::PermissionsExt;

        let root = make_temp_dir("listing-compare");
        let deep = root.join("a").join("b").join("c");
        fs::create_dir_all(&deep).unwrap();
        fs::create_dir_all(root.join("empty")).unwrap();
        fs::write(root.join("root.bin"), [1_u8; 10]).unwrap();
        fs::write(root.join("a").join("a.bin"), [1_u8; 200]).unwrap();
        fs::write(deep.join("deep.bin"), [1_u8; 3000]).unwrap();
        fs::write(root.join("공백 있는 이름.txt"), [1_u8; 7]).unwrap();
        // 폴더를 넘나드는 하드링크
        fs::hard_link(root.join("a").join("a.bin"), deep.join("a-link.bin")).unwrap();
        // 따라가지 않는 심볼릭 링크
        symlink(&deep, root.join("dir-link")).unwrap();
        symlink(root.join("root.bin"), root.join("file-link")).unwrap();
        // sparse 파일: 할당 크기로 센다
        let sparse = fs::File::create(root.join("disk.img")).unwrap();
        sparse.set_len(4 * 1024 * 1024 * 1024).unwrap();
        drop(sparse);
        // 읽을 수 없는 폴더
        let locked = root.join("a").join("locked");
        fs::create_dir_all(&locked).unwrap();
        fs::write(locked.join("hidden.bin"), [1_u8; 50]).unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();

        let path = root.to_str().unwrap();
        let cancel_flag = AtomicBool::new(false);
        let pool = build_scan_pool(2).unwrap();
        let scan =
            |listing| scan_path_size_with_listing(path, &cancel_flag, |_| {}, Some(&pool), listing);
        let bulk = scan(DirectoryListing::Bulk);
        let std_listing = scan(DirectoryListing::Std);

        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        fs::remove_dir_all(&root).unwrap();
        let (mut bulk, mut std_listing) = (bulk.unwrap(), std_listing.unwrap());
        for result in [&mut bulk, &mut std_listing] {
            result.started_at_ms = 0;
            result
                .children
                .sort_by(|left, right| left.path.cmp(&right.path));
        }
        assert_eq!(bulk, std_listing);
        assert!(
            bulk.size < 1024 * 1024,
            "sparse file counted as {}",
            bulk.size
        );
        assert!(bulk
            .children
            .iter()
            .any(|child| child.path.ends_with("/a/b")));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_scans_use_bulk_listing_with_at_most_six_threads() {
        assert_eq!(DirectoryListing::platform_default(), DirectoryListing::Bulk);
        assert!((4..=6).contains(&default_scan_threads()));
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
