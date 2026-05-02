use super::super::operations::{
    apply_batch_rename_operations, collapse_nested_paths, collect_delete_progress_targets,
    create_file, move_files_with_cancel_and_progress, rename_file, BatchRenameOperation,
};
use super::create_test_dir;
use std::fs;
use std::path::PathBuf;

#[test]
fn move_single_path_allows_target_file_path() {
    let tmp = create_test_dir("move_single_target_file_path");
    let source_dir = tmp.join("source");
    let target_dir = tmp.join("target");
    fs::create_dir_all(&source_dir).unwrap();
    fs::create_dir_all(&target_dir).unwrap();

    let source = source_dir.join("old.txt");
    let target = target_dir.join("new.txt");
    fs::write(&source, b"hello").unwrap();

    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(async {
        move_files_with_cancel_and_progress(
            vec![source.to_string_lossy().to_string()],
            target.to_string_lossy().to_string(),
            None,
            |_| {},
        )
        .await
    });

    assert!(
        result.is_ok(),
        "expected single-file move to target path to succeed"
    );
    assert!(!source.exists());
    assert_eq!(fs::read_to_string(&target).unwrap(), "hello");

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn move_multiple_paths_requires_existing_target_directory() {
    let tmp = create_test_dir("move_multiple_target_directory");
    let source_dir = tmp.join("source");
    let target_dir = tmp.join("target");
    fs::create_dir_all(&source_dir).unwrap();
    fs::create_dir_all(&target_dir).unwrap();

    let first = source_dir.join("a.txt");
    let second = source_dir.join("b.txt");
    let invalid_target = target_dir.join("renamed.txt");
    fs::write(&first, b"a").unwrap();
    fs::write(&second, b"b").unwrap();

    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(async {
        move_files_with_cancel_and_progress(
            vec![
                first.to_string_lossy().to_string(),
                second.to_string_lossy().to_string(),
            ],
            invalid_target.to_string_lossy().to_string(),
            None,
            |_| {},
        )
        .await
    });

    assert_eq!(
        result,
        Err(format!(
            "Move target must be an existing folder when moving multiple items: {}",
            invalid_target.display()
        ))
    );

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn move_single_path_rejects_existing_target_without_overwriting() {
    let tmp = create_test_dir("move_existing_target");
    let source_dir = tmp.join("source");
    let target_dir = tmp.join("target");
    fs::create_dir_all(&source_dir).unwrap();
    fs::create_dir_all(&target_dir).unwrap();

    let source = source_dir.join("source.txt");
    let target = target_dir.join("target.txt");
    fs::write(&source, b"source").unwrap();
    fs::write(&target, b"target").unwrap();

    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(async {
        move_files_with_cancel_and_progress(
            vec![source.to_string_lossy().to_string()],
            target.to_string_lossy().to_string(),
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
fn move_into_directory_rejects_existing_child_without_overwriting() {
    let tmp = create_test_dir("move_existing_child");
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
        move_files_with_cancel_and_progress(
            vec![source.to_string_lossy().to_string()],
            target_dir.to_string_lossy().to_string(),
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
fn create_file_rejects_existing_file_without_truncating() {
    let tmp = create_test_dir("create_file_existing");
    fs::create_dir_all(&tmp).unwrap();

    let existing = tmp.join("notes.txt");
    fs::write(&existing, b"keep me").unwrap();

    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(create_file(existing.to_string_lossy().to_string()));

    assert!(result.is_err());
    assert_eq!(fs::read(&existing).unwrap(), b"keep me");

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn rename_file_rejects_existing_target_without_overwriting() {
    let tmp = create_test_dir("rename_existing_target");
    fs::create_dir_all(&tmp).unwrap();

    let source = tmp.join("source.txt");
    let target = tmp.join("target.txt");
    fs::write(&source, b"source").unwrap();
    fs::write(&target, b"target").unwrap();

    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(rename_file(
        source.to_string_lossy().to_string(),
        target.to_string_lossy().to_string(),
    ));

    assert!(result.is_err());
    assert_eq!(fs::read(&source).unwrap(), b"source");
    assert_eq!(fs::read(&target).unwrap(), b"target");

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn rename_file_converts_decomposed_hangul_name_to_nfc() {
    let tmp = create_test_dir("rename_nfd_to_nfc");
    fs::create_dir_all(&tmp).unwrap();

    let decomposed_name = "\u{1106}\u{1165}\u{1109}\u{1175}\u{11AB}.txt";
    let nfc_name = "\u{BA38}\u{C2E0}.txt";
    let source = tmp.join(decomposed_name);
    let target = tmp.join(nfc_name);
    fs::write(&source, b"source").unwrap();

    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(rename_file(
        source.to_string_lossy().to_string(),
        target.to_string_lossy().to_string(),
    ));

    assert!(result.is_ok());
    assert_eq!(fs::read(&target).unwrap(), b"source");

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn collapse_nested_removes_children() {
    let paths = vec!["/a".to_string(), "/a/b".to_string(), "/a/b/c".to_string()];
    let result = collapse_nested_paths(paths);
    assert_eq!(result, vec![PathBuf::from("/a")]);
}

#[test]
fn collapse_nested_keeps_siblings() {
    let paths = vec!["/a".to_string(), "/b".to_string(), "/c".to_string()];
    let result = collapse_nested_paths(paths);
    assert_eq!(result.len(), 3);
}

#[test]
fn collapse_nested_handles_overlapping_prefixes() {
    let paths = vec!["/a".to_string(), "/app".to_string()];
    let result = collapse_nested_paths(paths);
    assert_eq!(result.len(), 2);
}

#[test]
fn collapse_nested_removes_exact_duplicate() {
    let paths = vec!["/a/b".to_string(), "/a/b".to_string()];
    let result = collapse_nested_paths(paths);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0], PathBuf::from("/a/b"));
}

#[test]
fn collapse_nested_empty_vec() {
    let result = collapse_nested_paths(vec![]);
    assert!(result.is_empty());
}

#[test]
fn collect_delete_progress_targets_collapses_nested_entries() {
    let paths = vec![
        "/tmp/root".to_string(),
        "/tmp/root/child.txt".to_string(),
        "/tmp/other.txt".to_string(),
    ];

    let result = collect_delete_progress_targets(paths);

    assert_eq!(
        result,
        vec![PathBuf::from("/tmp/root"), PathBuf::from("/tmp/other.txt")]
    );
}

#[test]
fn batch_rename_swaps_file_names_safely() {
    let tmp = create_test_dir("batch_swap");
    fs::create_dir_all(&tmp).unwrap();

    let a_path = tmp.join("a.txt");
    let b_path = tmp.join("b.txt");
    fs::write(&a_path, b"alpha").unwrap();
    fs::write(&b_path, b"beta").unwrap();

    apply_batch_rename_operations(vec![
        BatchRenameOperation {
            old_path: a_path.to_string_lossy().to_string(),
            new_path: b_path.to_string_lossy().to_string(),
        },
        BatchRenameOperation {
            old_path: b_path.to_string_lossy().to_string(),
            new_path: a_path.to_string_lossy().to_string(),
        },
    ])
    .unwrap();

    assert_eq!(fs::read(a_path).unwrap(), b"beta");
    assert_eq!(fs::read(b_path).unwrap(), b"alpha");

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn batch_rename_rejects_existing_target_outside_batch() {
    let tmp = create_test_dir("batch_conflict");
    fs::create_dir_all(&tmp).unwrap();

    let a_path = tmp.join("a.txt");
    let c_path = tmp.join("c.txt");
    fs::write(&a_path, b"alpha").unwrap();
    fs::write(&c_path, b"charlie").unwrap();

    let result = apply_batch_rename_operations(vec![BatchRenameOperation {
        old_path: a_path.to_string_lossy().to_string(),
        new_path: c_path.to_string_lossy().to_string(),
    }]);

    assert!(result.is_err());

    let _ = fs::remove_dir_all(&tmp);
}
