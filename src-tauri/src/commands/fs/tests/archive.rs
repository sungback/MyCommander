use super::super::archive::{
    extract_zip_archive, extract_zip_entries_native, flatten_matching_archive_root_dir,
    get_hidden_temp_archive_path, get_unique_archive_path, get_unique_archive_path_named,
    get_unique_extraction_dir, preview_zip_archive_sync, validate_zip_source_directory,
};
use super::create_test_dir;
use std::fs;
use std::path::Path;

fn create_test_zip_archive(archive_path: &Path, files: &[(&str, &[u8])], dirs: &[&str]) {
    use std::io::Write;
    if let Some(parent) = archive_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let file = fs::File::create(archive_path).unwrap();
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();

    for dir in dirs {
        zip.add_directory(*dir, options).unwrap();
    }
    for (name, content) in files {
        zip.start_file(*name, options).unwrap();
        zip.write_all(content).unwrap();
    }
    zip.finish().unwrap();
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
fn extract_zip_archive_rejects_nonexistent_path() {
    let result = extract_zip_archive("/nonexistent/path/that/does/not/exist.zip");
    assert!(result.is_err());
}

#[test]
fn extract_zip_archive_rejects_non_zip_extension() {
    let tmp = create_test_dir("extract_non_zip");
    fs::create_dir_all(&tmp).unwrap();
    let file = tmp.join("notes.txt");
    fs::write(&file, b"hello").unwrap();

    let result = extract_zip_archive(file.to_str().unwrap());
    assert!(result.is_err());

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn extract_zip_archive_extracts_contents() {
    let tmp = create_test_dir("extract_zip_contents");
    let archive = tmp.join("source.zip");
    create_test_zip_archive(&archive, &[("source/hello.txt", b"world")], &["source"]);

    let result = extract_zip_archive(archive.to_str().unwrap());
    assert!(result.is_ok(), "extract failed: {:?}", result);

    let extraction_dir = std::path::PathBuf::from(result.unwrap());
    assert!(extraction_dir.exists());
    assert!(extraction_dir.join("hello.txt").exists());
    assert_eq!(
        fs::read(extraction_dir.join("hello.txt")).unwrap(),
        b"world"
    );

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn validate_zip_source_directory_rejects_nonexistent_path() {
    let result = validate_zip_source_directory("/nonexistent/path/does/not/exist");
    assert!(result.is_err());
}

#[test]
fn unique_archive_path_named_base_name() {
    let tmp = create_test_dir("archive_named_base");
    let result = get_unique_archive_path_named(&tmp, "backup").unwrap();
    assert_eq!(result, tmp.join("backup.zip"));
    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn unique_archive_path_named_increments_when_exists() {
    let tmp = create_test_dir("archive_named_suffix");
    fs::create_dir_all(&tmp).unwrap();
    fs::write(tmp.join("backup.zip"), b"").unwrap();
    let result = get_unique_archive_path_named(&tmp, "backup").unwrap();
    assert_eq!(result, tmp.join("backup 2.zip"));
    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn unique_archive_path_named_uses_archive_when_stem_is_empty() {
    let tmp = create_test_dir("archive_named_empty_stem");
    // get_unique_archive_path_named은 빈 stem을 호출자가 처리하므로
    // stem을 "Archive"로 전달하는 동작을 검증한다
    let result = get_unique_archive_path_named(&tmp, "Archive").unwrap();
    assert_eq!(result, tmp.join("Archive.zip"));
    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn hidden_temp_archive_path_adds_partial_suffix() {
    let tmp = create_test_dir("hidden_temp_archive");
    let archive = tmp.join("data.zip");
    let result = get_hidden_temp_archive_path(&archive).unwrap();
    assert_eq!(result, tmp.join(".data.zip.partial"));
    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn hidden_temp_archive_path_increments_when_partial_exists() {
    let tmp = create_test_dir("hidden_temp_archive_suffix");
    fs::create_dir_all(&tmp).unwrap();
    let archive = tmp.join("data.zip");
    fs::write(tmp.join(".data.zip.partial"), b"").unwrap();
    let result = get_hidden_temp_archive_path(&archive).unwrap();
    assert_eq!(result, tmp.join(".data.zip.partial.2"));
    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn preview_zip_archive_sync_reads_zip_metadata_and_entries() {
    let tmp = create_test_dir("preview_zip_test");
    let archive = tmp.join("test.zip");
    create_test_zip_archive(
        &archive,
        &[
            ("document.txt", b"Hello Zip World!"),
            ("subfolder/data.json", b"{\"key\":\"value\"}"),
        ],
        &["subfolder"],
    );

    let preview = preview_zip_archive_sync(archive.to_str().unwrap()).unwrap();
    assert_eq!(preview.file_name, "test.zip");
    assert!(preview.file_size > 0);
    assert_eq!(preview.total_files, 2);
    assert!(preview.total_dirs >= 1);
    assert_eq!(preview.total_uncompressed_size, 16 + 15);

    let doc_entry = preview
        .entries
        .iter()
        .find(|e| e.name == "document.txt")
        .expect("document.txt entry must exist");
    assert!(!doc_entry.is_dir);
    assert_eq!(doc_entry.size, 16);

    let json_entry = preview
        .entries
        .iter()
        .find(|e| e.name == "data.json")
        .expect("data.json entry must exist");
    assert!(!json_entry.is_dir);
    assert_eq!(json_entry.size, 15);

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn extract_zip_entries_native_extracts_nested_and_unicode_files() {
    let tmp = create_test_dir("native_extract_test");
    let archive = tmp.join("lecture-data-analysis.zip");
    create_test_zip_archive(
        &archive,
        &[
            ("data/분석_1004.txt", "강의 데이터 분석 결과".as_bytes()),
            ("notes with space.txt", b"sample content"),
        ],
        &["data", "empty_folder"],
    );

    let target_dir = tmp.join("extracted");
    fs::create_dir_all(&target_dir).unwrap();

    let result = extract_zip_entries_native(&archive, &target_dir);
    assert!(result.is_ok(), "native extract failed: {:?}", result);

    assert!(target_dir.join("data/분석_1004.txt").exists());
    assert_eq!(
        fs::read(target_dir.join("data/분석_1004.txt")).unwrap(),
        "강의 데이터 분석 결과".as_bytes()
    );
    assert!(target_dir.join("notes with space.txt").exists());
    assert_eq!(
        fs::read(target_dir.join("notes with space.txt")).unwrap(),
        b"sample content"
    );
    assert!(target_dir.join("empty_folder").is_dir());

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn extract_zip_entries_native_rejects_zip_slip() {
    let tmp = create_test_dir("native_zip_slip_test");
    let archive = tmp.join("malicious.zip");
    create_test_zip_archive(&archive, &[("../escape.txt", b"malicious payload")], &[]);

    let target_dir = tmp.join("extracted");
    fs::create_dir_all(&target_dir).unwrap();

    let result = extract_zip_entries_native(&archive, &target_dir);
    assert!(result.is_err(), "should reject zip slip entry");
    assert!(
        result.unwrap_err().contains("unsafe path entry"),
        "error message should mention unsafe path"
    );

    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn preview_zip_archive_sync_rejects_non_zip_or_missing_file() {
    let result = preview_zip_archive_sync("/nonexistent/file.zip");
    assert!(result.is_err());

    let tmp = create_test_dir("preview_not_zip");
    fs::create_dir_all(&tmp).unwrap();
    let invalid_file = tmp.join("not_zip.zip");
    fs::write(&invalid_file, b"This is not a zip file").unwrap();

    let result = preview_zip_archive_sync(invalid_file.to_str().unwrap());
    assert!(result.is_err());

    let _ = fs::remove_dir_all(&tmp);
}
