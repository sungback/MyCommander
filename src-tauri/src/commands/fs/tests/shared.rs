use super::super::metadata::compute_path_size;
use super::super::shared::{compact_command_output, indicates_invalid_zip_message};
use std::fs;

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
