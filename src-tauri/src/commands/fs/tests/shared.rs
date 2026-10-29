use super::super::shared::{compact_command_output, indicates_invalid_zip_message};

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
