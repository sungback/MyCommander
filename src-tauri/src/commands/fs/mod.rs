pub(crate) mod archive;
pub(crate) mod metadata;
pub(crate) mod operations;
pub(crate) mod shared;

pub(crate) use archive::{cancel_zip_operation, create_zip, create_zip_from_paths};
pub(crate) use operations::{
    copy_files_with_cancel_and_progress, delete_files_with_cancel_and_progress,
    move_files_with_cancel_and_progress,
};
pub use shared::ProgressPayload;

#[cfg(test)]
mod tests {
    use super::archive::{
        flatten_matching_archive_root_dir, get_unique_archive_path, get_unique_extraction_dir,
        validate_zip_source_directory,
    };
    use super::metadata::{compute_path_size, decode_preview_bytes, is_hidden_entry};
    use super::operations::{
        apply_batch_rename_operations, collapse_nested_paths, collect_delete_progress_targets,
        create_file, move_files_with_cancel_and_progress, rename_file, BatchRenameOperation,
    };
    use super::shared::{compact_command_output, indicates_invalid_zip_message};
    use encoding_rs::EUC_KR;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn create_test_dir(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("mycommander_{name}_{suffix}"))
    }

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
    fn hidden_entry_dot_prefix() {
        let dir = std::env::temp_dir();
        let metadata = fs::metadata(&dir).unwrap();
        assert!(is_hidden_entry(".hidden", &metadata));
    }

    #[test]
    fn hidden_entry_normal_file() {
        let dir = std::env::temp_dir();
        let metadata = fs::metadata(&dir).unwrap();
        assert!(!is_hidden_entry("visible.txt", &metadata));
    }

    #[test]
    fn decode_preview_bytes_keeps_utf8_text() {
        let decoded = decode_preview_bytes("plain utf8 text".as_bytes());
        assert_eq!(decoded, "plain utf8 text");
    }

    #[test]
    fn decode_preview_bytes_decodes_utf16le_with_bom() {
        let mut bytes = vec![0xFF, 0xFE];
        for unit in "Hello UTF16".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }

        let decoded = decode_preview_bytes(&bytes);
        assert_eq!(decoded, "Hello UTF16");
    }

    #[test]
    fn decode_preview_bytes_decodes_utf16le_without_bom_when_pattern_matches() {
        let mut bytes = Vec::new();
        for unit in "Hello".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }

        let decoded = decode_preview_bytes(&bytes);
        assert_eq!(decoded, "Hello");
    }

    #[test]
    fn decode_preview_bytes_falls_back_to_lossy_utf8() {
        let decoded = decode_preview_bytes(&[0x66, 0x6f, 0x80, 0x6f]);
        assert_eq!(decoded, "fo\u{FFFD}o");
    }

    #[test]
    fn decode_preview_bytes_decodes_euc_kr_text() {
        let (bytes, _, had_errors) = EUC_KR.encode("안녕하세요");
        assert!(!had_errors);

        let decoded = decode_preview_bytes(bytes.as_ref());
        assert_eq!(decoded, "안녕하세요");
    }

    #[test]
    fn hidden_entry_dot_and_dotdot_are_not_hidden() {
        let dir = std::env::temp_dir();
        let metadata = fs::metadata(&dir).unwrap();
        assert!(!is_hidden_entry(".", &metadata));
        assert!(!is_hidden_entry("..", &metadata));
    }

    #[test]
    fn unique_extraction_dir_base_name() {
        let tmp = std::env::temp_dir().join("test_extract_unique");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let archive = tmp.join("data.zip");
        fs::write(&archive, b"").unwrap();

        let result = get_unique_extraction_dir(&archive).unwrap();
        assert_eq!(result, tmp.join("data"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_extraction_dir_increments_suffix() {
        let tmp = std::env::temp_dir().join("test_extract_suffix");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let archive = tmp.join("data.zip");
        fs::write(&archive, b"").unwrap();
        fs::create_dir_all(tmp.join("data")).unwrap();

        let result = get_unique_extraction_dir(&archive).unwrap();
        assert_eq!(result, tmp.join("data 2"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_extraction_dir_handles_unicode_and_spaces() {
        let tmp = create_test_dir("extract_unicode_space");
        let parent = tmp.join("내 드라이브").join("_aaa");
        fs::create_dir_all(&parent).unwrap();

        let archive = parent.join("watchcat.zip");
        fs::write(&archive, b"").unwrap();

        let result = get_unique_extraction_dir(&archive).unwrap();
        assert_eq!(result, parent.join("watchcat"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_archive_path_base_name() {
        let tmp = std::env::temp_dir().join("test_archive_unique");
        let source = tmp.join("data");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&source).unwrap();

        let result = get_unique_archive_path(&source).unwrap();
        assert_eq!(result, tmp.join("data.zip"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_archive_path_increments_suffix() {
        let tmp = std::env::temp_dir().join("test_archive_suffix");
        let source = tmp.join("data");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&source).unwrap();
        fs::write(tmp.join("data.zip"), b"").unwrap();

        let result = get_unique_archive_path(&source).unwrap();
        assert_eq!(result, tmp.join("data 2.zip"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn flattens_single_top_level_directory_matching_archive_name() {
        let tmp = create_test_dir("flatten_archive_root");
        let extraction_dir = tmp.join("abc");
        let nested_root = extraction_dir.join("abc");
        let nested_child = nested_root.join("notes.txt");

        fs::create_dir_all(&nested_root).unwrap();
        fs::write(&nested_child, b"hello").unwrap();

        flatten_matching_archive_root_dir(&extraction_dir, Path::new("abc.zip")).unwrap();

        assert!(extraction_dir.join("notes.txt").exists());
        assert!(!nested_root.exists());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn keeps_single_top_level_directory_when_name_differs_from_archive() {
        let tmp = create_test_dir("keep_archive_root");
        let extraction_dir = tmp.join("abc");
        let nested_root = extraction_dir.join("other");
        let nested_child = nested_root.join("notes.txt");

        fs::create_dir_all(&nested_root).unwrap();
        fs::write(&nested_child, b"hello").unwrap();

        flatten_matching_archive_root_dir(&extraction_dir, Path::new("abc.zip")).unwrap();

        assert!(nested_child.exists());
        assert!(!extraction_dir.join("notes.txt").exists());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn create_zip_archive_rejects_non_directory() {
        let tmp = std::env::temp_dir().join("test_create_zip_file.txt");
        let _ = fs::remove_file(&tmp);
        fs::write(&tmp, b"hello").unwrap();

        let result = validate_zip_source_directory(tmp.to_str().unwrap());
        assert!(result.is_err());

        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn compute_path_size_for_single_file() {
        let tmp = std::env::temp_dir().join("test_size_file");
        let _ = fs::remove_file(&tmp);

        let content = b"hello world";
        fs::write(&tmp, content).unwrap();

        let size = compute_path_size(tmp.to_str().unwrap()).unwrap();
        assert_eq!(size, content.len() as u64);

        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn compute_path_size_nonexistent_path() {
        let result = compute_path_size("/nonexistent/path/that/should/not/exist");
        assert!(result.is_err());
    }

    #[test]
    fn compact_command_output_removes_extra_whitespace() {
        let result = compact_command_output(b"line one\n  line two\t\tline three  ");
        assert_eq!(result.as_deref(), Some("line one line two line three"));
    }

    #[test]
    fn indicates_invalid_zip_message_detects_missing_central_directory() {
        assert!(indicates_invalid_zip_message(
            "End-of-central-directory signature not found"
        ));
        assert!(!indicates_invalid_zip_message("permission denied"));
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
}
