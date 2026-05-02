use super::super::metadata::{decode_preview_bytes, is_hidden_entry};
use encoding_rs::EUC_KR;
use std::fs;

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
