use super::super::metadata::{
    decode_preview_bytes, is_hidden_entry, path_matches_denied_home_path,
    read_preview_file_content_for_test,
};
use encoding_rs::EUC_KR;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_preview_test_path(file_name: &str) -> PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!(
        "mycommander-preview-test-{}-{}",
        std::process::id(),
        suffix
    ));
    fs::create_dir_all(&dir).unwrap();
    dir.join(file_name)
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
fn explicit_preview_read_limit_allows_tilde_notebook_names() {
    let file_path = unique_preview_test_path("~.ipynb");
    let content = r#"{"cells":[],"metadata":{}}"#;
    fs::write(&file_path, content).unwrap();

    let decoded = read_preview_file_content_for_test(&file_path, Some(5 * 1024 * 1024)).unwrap();

    assert_eq!(decoded, content);
    fs::remove_dir_all(file_path.parent().unwrap()).unwrap();
}

#[test]
fn explicit_preview_read_limit_rejects_files_over_limit() {
    let file_path = unique_preview_test_path("large.ipynb");
    fs::write(&file_path, "abcd").unwrap();

    let error = read_preview_file_content_for_test(&file_path, Some(3)).unwrap_err();

    assert_eq!(
        error,
        "파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다."
    );
    fs::remove_dir_all(file_path.parent().unwrap()).unwrap();
}

#[test]
fn hidden_entry_dot_and_dotdot_are_not_hidden() {
    let dir = std::env::temp_dir();
    let metadata = fs::metadata(&dir).unwrap();
    assert!(!is_hidden_entry(".", &metadata));
    assert!(!is_hidden_entry("..", &metadata));
}

#[test]
fn preview_read_policy_blocks_sensitive_home_paths() {
    let home = Path::new("/Users/example");

    assert!(path_matches_denied_home_path(
        Path::new("/Users/example/.ssh/config"),
        home
    ));
    assert!(path_matches_denied_home_path(
        Path::new("/Users/example/.aws/credentials"),
        home
    ));
    assert!(path_matches_denied_home_path(
        Path::new("/Users/example/Library/Keychains/login.keychain-db"),
        home
    ));
}

#[test]
fn preview_read_policy_allows_similar_but_non_denied_paths() {
    let home = Path::new("/Users/example");

    assert!(!path_matches_denied_home_path(
        Path::new("/Users/example/Documents/.ssh-notes/config.txt"),
        home
    ));
    assert!(!path_matches_denied_home_path(
        Path::new("/Users/example/Library/Logs/app.log"),
        home
    ));
    assert!(!path_matches_denied_home_path(
        Path::new("/Users/other/.ssh/config"),
        home
    ));
}
