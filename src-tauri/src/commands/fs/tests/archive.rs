use super::super::archive::{
    flatten_matching_archive_root_dir, get_unique_archive_path, get_unique_extraction_dir,
    validate_zip_source_directory,
};
use super::create_test_dir;
use std::fs;
use std::path::Path;

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
