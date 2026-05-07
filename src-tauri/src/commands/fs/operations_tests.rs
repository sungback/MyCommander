use super::*;
use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

fn create_test_dir(name: &str) -> PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("mycommander_operations_{name}_{suffix}"))
}

#[test]
fn move_path_falls_back_when_rename_crosses_filesystems() {
    let tmp = create_test_dir("cross_filesystem_file_move");
    let source_dir = tmp.join("source");
    let target_dir = tmp.join("target");
    fs::create_dir_all(&source_dir).unwrap();
    fs::create_dir_all(&target_dir).unwrap();

    let source = source_dir.join("notes.txt");
    let target = target_dir.join("notes.txt");
    fs::write(&source, b"hello").unwrap();

    let result = move_path_to_destination_with_rename(
        &source,
        &target,
        |_source, _target| {
            Err(std::io::Error::new(
                ErrorKind::CrossesDevices,
                "cross-device link",
            ))
        },
        None,
    );

    assert!(result.is_ok());
    assert!(!source.exists());
    assert_eq!(fs::read(&target).unwrap(), b"hello");

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn move_path_cross_filesystem_fallback_handles_directories() {
    let tmp = create_test_dir("cross_filesystem_directory_move");
    let source = tmp.join("source");
    let target = tmp.join("target");
    fs::create_dir_all(source.join("nested")).unwrap();
    fs::write(source.join("nested").join("notes.txt"), b"hello").unwrap();

    let result = move_path_to_destination_with_rename(
        &source,
        &target,
        |_source, _target| {
            Err(std::io::Error::new(
                ErrorKind::CrossesDevices,
                "cross-device link",
            ))
        },
        None,
    );

    assert!(result.is_ok());
    assert!(!source.exists());
    assert_eq!(
        fs::read(target.join("nested").join("notes.txt")).unwrap(),
        b"hello"
    );

    let _ = fs::remove_dir_all(&tmp);
}

#[cfg(unix)]
#[test]
fn cross_filesystem_move_cleans_temporary_destination_when_copy_fails() {
    let tmp = create_test_dir("cross_filesystem_move_copy_failure_cleanup");
    let source = tmp.join("source");
    let target_dir = tmp.join("target");
    let target = target_dir.join("source");
    fs::create_dir_all(source.join("real_dir")).unwrap();
    fs::create_dir_all(&target_dir).unwrap();
    fs::write(source.join("notes.txt"), b"hello").unwrap();
    std::os::unix::fs::symlink(source.join("real_dir"), source.join("dir_link")).unwrap();

    let result = move_path_to_destination_with_rename(
        &source,
        &target,
        |_source, _target| {
            Err(std::io::Error::new(
                ErrorKind::CrossesDevices,
                "cross-device link",
            ))
        },
        None,
    );

    assert!(result.is_err());
    assert!(source.exists());
    assert!(!target.exists());
    let temp_entries = fs::read_dir(&target_dir)
        .unwrap()
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with(".__mycommander_move_")
        })
        .count();
    assert_eq!(temp_entries, 0);

    let _ = fs::remove_dir_all(&tmp);
}

#[cfg(unix)]
#[test]
fn directory_copy_cleans_new_destination_when_recursive_copy_fails() {
    let tmp = create_test_dir("directory_copy_failure_cleanup");
    let source = tmp.join("source");
    let target = tmp.join("target").join("source");
    fs::create_dir_all(source.join("real_dir")).unwrap();
    fs::write(source.join("notes.txt"), b"hello").unwrap();
    std::os::unix::fs::symlink(source.join("real_dir"), source.join("dir_link")).unwrap();

    let result = copy_path_to_destination(&source, &target, false, None);

    assert!(result.is_err());
    assert!(source.exists());
    assert!(!target.exists());

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn directory_copy_cleans_new_destination_when_cancelled_during_recursive_copy() {
    let tmp = create_test_dir("directory_copy_cancel_cleanup");
    let source = tmp.join("source");
    let target = tmp.join("target").join("source");
    fs::create_dir_all(&source).unwrap();
    fs::write(source.join("notes.txt"), b"hello").unwrap();
    let cancel_flag = AtomicBool::new(true);

    let result = copy_path_to_destination(&source, &target, false, Some(&cancel_flag));

    assert_eq!(result, Err("Operation cancelled.".to_string()));
    assert!(source.exists());
    assert!(!target.exists());
    assert!(cancel_flag.load(Ordering::SeqCst));

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn copy_conflicts_include_duplicate_batch_destinations() {
    let tmp = create_test_dir("copy_duplicate_destinations");
    let first_dir = tmp.join("first");
    let second_dir = tmp.join("second");
    let target = tmp.join("target");
    fs::create_dir_all(&first_dir).unwrap();
    fs::create_dir_all(&second_dir).unwrap();
    fs::create_dir_all(&target).unwrap();

    let first = first_dir.join("notes.txt");
    let second = second_dir.join("notes.txt");
    fs::write(&first, b"first").unwrap();
    fs::write(&second, b"second").unwrap();

    let result = collect_copy_conflicts(
        &[
            first.to_string_lossy().to_string(),
            second.to_string_lossy().to_string(),
        ],
        &target.to_string_lossy(),
    )
    .unwrap();

    assert_eq!(result, vec!["notes.txt"]);

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn copy_conflicts_use_directory_semantics_for_multiple_sources() {
    let tmp = create_test_dir("copy_multiple_missing_target");
    let first_dir = tmp.join("first");
    let second_dir = tmp.join("second");
    let target = tmp.join("new-target");
    fs::create_dir_all(&first_dir).unwrap();
    fs::create_dir_all(&second_dir).unwrap();

    let first = first_dir.join("notes.txt");
    let second = second_dir.join("notes.txt");
    fs::write(&first, b"first").unwrap();
    fs::write(&second, b"second").unwrap();

    let result = collect_copy_conflicts(
        &[
            first.to_string_lossy().to_string(),
            second.to_string_lossy().to_string(),
        ],
        &target.to_string_lossy(),
    )
    .unwrap();

    assert_eq!(result, vec!["notes.txt"]);
    assert!(!target.exists());

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn copy_file_rejects_existing_target_without_overwrite() {
    let tmp = create_test_dir("copy_existing_target");
    let source_dir = tmp.join("source");
    let target_dir = tmp.join("target");
    fs::create_dir_all(&source_dir).unwrap();
    fs::create_dir_all(&target_dir).unwrap();

    let source = source_dir.join("notes.txt");
    let target = target_dir.join("notes.txt");
    fs::write(&source, b"source").unwrap();
    fs::write(&target, b"target").unwrap();

    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(async {
        copy_files_with_cancel_and_progress(
            vec![source.to_string_lossy().to_string()],
            target.to_string_lossy().to_string(),
            None,
            None,
            None,
            |_| {},
        )
        .await
    });

    assert!(result.is_err());
    assert_eq!(fs::read(&source).unwrap(), b"source");
    assert_eq!(fs::read(&target).unwrap(), b"target");

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn copy_file_overwrites_existing_target_when_explicit() {
    let tmp = create_test_dir("copy_existing_target_with_overwrite");
    let source_dir = tmp.join("source");
    let target_dir = tmp.join("target");
    fs::create_dir_all(&source_dir).unwrap();
    fs::create_dir_all(&target_dir).unwrap();

    let source = source_dir.join("notes.txt");
    let target = target_dir.join("notes.txt");
    fs::write(&source, b"source").unwrap();
    fs::write(&target, b"target").unwrap();

    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(async {
        copy_files_with_cancel_and_progress(
            vec![source.to_string_lossy().to_string()],
            target.to_string_lossy().to_string(),
            None,
            Some(true),
            None,
            |_| {},
        )
        .await
    });

    assert!(result.is_ok());
    assert_eq!(fs::read(&source).unwrap(), b"source");
    assert_eq!(fs::read(&target).unwrap(), b"source");

    let _ = fs::remove_dir_all(&tmp);
}
