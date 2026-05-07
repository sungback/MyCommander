use super::{
    matches_entry_kind, matches_extensions, matches_modified_range, matches_query, matches_size,
};
use glob::Pattern;
use regex::Regex;

#[test]
fn plain_text_search_preserves_case() {
    assert!(matches_query(
        "Report.txt",
        "Report",
        true,
        false,
        None,
        &[]
    ));
    assert!(!matches_query(
        "Report.txt",
        "report",
        true,
        false,
        None,
        &[]
    ));
}

#[test]
fn wildcard_search_preserves_case() {
    let patterns = vec![Pattern::new("*.TXT").expect("valid pattern")];

    assert!(matches_query(
        "README.TXT",
        "*.TXT",
        true,
        false,
        None,
        &patterns
    ));
    assert!(!matches_query(
        "readme.txt",
        "*.TXT",
        true,
        false,
        None,
        &patterns
    ));
}

#[test]
fn regex_search_keeps_existing_behavior() {
    let regex = Regex::new("^[A-Z]+\\.txt$").expect("valid regex");

    assert!(matches_query(
        "README.txt",
        "^[A-Z]+\\.txt$",
        true,
        true,
        Some(&regex),
        &[]
    ));
    assert!(!matches_query(
        "readme.txt",
        "^[A-Z]+\\.txt$",
        true,
        true,
        Some(&regex),
        &[]
    ));
}

#[test]
fn plain_text_search_can_ignore_case() {
    assert!(matches_query(
        "report.txt",
        "REPORT",
        false,
        false,
        None,
        &[]
    ));
}

#[test]
fn entry_kind_filter_matches_expected_types() {
    assert!(matches_entry_kind(true, "all"));
    assert!(matches_entry_kind(false, "files"));
    assert!(!matches_entry_kind(true, "files"));
    assert!(matches_entry_kind(true, "directories"));
    assert!(!matches_entry_kind(false, "directories"));
}

#[test]
fn extension_filter_normalizes_to_lowercase() {
    assert!(matches_extensions(
        "Report.TXT",
        false,
        &[String::from("txt")]
    ));
    assert!(!matches_extensions(
        "Report.md",
        false,
        &[String::from("txt")]
    ));
    assert!(!matches_extensions("docs", true, &[String::from("txt")]));
}

#[test]
fn size_filter_respects_min_and_max() {
    assert!(matches_size(Some(1024), Some(100), Some(2048)));
    assert!(!matches_size(Some(50), Some(100), Some(2048)));
    assert!(!matches_size(Some(4096), Some(100), Some(2048)));
}

#[test]
fn modified_filter_respects_range() {
    assert!(matches_modified_range(Some(1500), Some(1000), Some(2000)));
    assert!(!matches_modified_range(Some(500), Some(1000), Some(2000)));
    assert!(!matches_modified_range(Some(2500), Some(1000), Some(2000)));
}
