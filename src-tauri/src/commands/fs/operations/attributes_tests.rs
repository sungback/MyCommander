use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};

static COUNTER: AtomicUsize = AtomicUsize::new(0);

fn temp_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "mycommander-attributes-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&dir).unwrap();
    dir
}

// 2020-01-02T03:04:05.678Z
const SAMPLE_MS: i64 = 1_577_934_245_678;

#[test]
fn converts_milliseconds_to_system_time_and_back() {
    for ms in [0, 1, SAMPLE_MS, -1, -86_400_000] {
        let time = system_time_from_ms(ms).unwrap();
        assert_eq!(ms_from_system_time(time), ms);
    }
}

#[test]
fn rejects_out_of_range_milliseconds() {
    assert!(system_time_from_ms(MAX_MODIFIED_MS + 1).is_err());
    assert!(system_time_from_ms(MIN_MODIFIED_MS - 1).is_err());
    assert!(system_time_from_ms(i64::MAX).is_err());
}

#[test]
fn sets_modified_time_and_reads_it_back() {
    let dir = temp_dir();
    let file = dir.join("a.txt");
    fs::write(&file, b"x").unwrap();

    let result = apply_file_attributes(&file, Some(SAMPLE_MS), None).unwrap();

    assert_eq!(result.modified_ms, Some(SAMPLE_MS));
    assert_eq!(read_attributes(&file).unwrap().modified_ms, Some(SAMPLE_MS));
    assert_eq!(fs::read(&file).unwrap(), b"x");
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn toggles_read_only_without_touching_the_time() {
    let dir = temp_dir();
    let file = dir.join("a.txt");
    fs::write(&file, b"x").unwrap();
    apply_file_attributes(&file, Some(SAMPLE_MS), None).unwrap();

    let locked = apply_file_attributes(&file, None, Some(true)).unwrap();
    assert!(locked.read_only);
    assert_eq!(locked.modified_ms, Some(SAMPLE_MS));

    let unlocked = apply_file_attributes(&file, None, Some(false)).unwrap();
    assert!(!unlocked.read_only);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn changes_the_time_of_a_read_only_file_and_keeps_it_read_only() {
    let dir = temp_dir();
    let file = dir.join("locked.txt");
    fs::write(&file, b"x").unwrap();
    apply_file_attributes(&file, None, Some(true)).unwrap();

    let result = apply_file_attributes(&file, Some(SAMPLE_MS), None).unwrap();

    assert_eq!(result.modified_ms, Some(SAMPLE_MS));
    assert!(result.read_only);
    apply_file_attributes(&file, None, Some(false)).unwrap();
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn applies_time_and_read_only_together() {
    let dir = temp_dir();
    let file = dir.join("a.txt");
    fs::write(&file, b"x").unwrap();

    let result = apply_file_attributes(&file, Some(SAMPLE_MS), Some(true)).unwrap();

    assert_eq!(result.modified_ms, Some(SAMPLE_MS));
    assert!(result.read_only);
    apply_file_attributes(&file, None, Some(false)).unwrap();
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn invalid_time_changes_nothing() {
    let dir = temp_dir();
    let file = dir.join("a.txt");
    fs::write(&file, b"x").unwrap();
    let before = read_attributes(&file).unwrap();

    assert!(apply_file_attributes(&file, Some(i64::MAX), Some(true)).is_err());

    assert_eq!(read_attributes(&file).unwrap(), before);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn reports_missing_paths() {
    let dir = temp_dir();
    assert!(read_attributes(&dir.join("nope")).is_err());
    assert!(apply_file_attributes(&dir.join("nope"), Some(0), None).is_err());
    fs::remove_dir_all(dir).unwrap();
}

#[cfg(unix)]
#[test]
fn clearing_read_only_does_not_make_the_file_world_writable() {
    use std::os::unix::fs::PermissionsExt;
    let dir = temp_dir();
    let file = dir.join("a.txt");
    fs::write(&file, b"x").unwrap();
    fs::set_permissions(&file, Permissions::from_mode(0o444)).unwrap();

    apply_file_attributes(&file, None, Some(false)).unwrap();

    assert_eq!(
        fs::metadata(&file).unwrap().permissions().mode() & 0o777,
        0o644
    );
    fs::remove_dir_all(dir).unwrap();
}

#[cfg(unix)]
#[test]
fn changes_the_time_of_a_folder_on_unix() {
    let dir = temp_dir();
    let folder = dir.join("sub");
    fs::create_dir(&folder).unwrap();

    let result = apply_file_attributes(&folder, Some(SAMPLE_MS), None).unwrap();

    assert!(result.is_dir);
    assert_eq!(result.modified_ms, Some(SAMPLE_MS));
    fs::remove_dir_all(dir).unwrap();
}

#[cfg(unix)]
#[test]
fn refuses_to_change_symlinks() {
    let dir = temp_dir();
    let file = dir.join("a.txt");
    let link = dir.join("link");
    fs::write(&file, b"x").unwrap();
    std::os::unix::fs::symlink(&file, &link).unwrap();
    let before = read_attributes(&file).unwrap();

    assert!(apply_file_attributes(&link, Some(SAMPLE_MS), Some(true)).is_err());

    assert_eq!(read_attributes(&file).unwrap(), before);
    assert!(read_attributes(&link).unwrap().is_symlink);
    fs::remove_dir_all(dir).unwrap();
}
