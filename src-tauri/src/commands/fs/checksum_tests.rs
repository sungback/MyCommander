use super::*;
use std::sync::atomic::AtomicUsize;

static COUNTER: AtomicUsize = AtomicUsize::new(0);

fn temp_dir() -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "mycommander-checksum-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

const ABC_MD5: &str = "900150983cd24fb0d6963f7d28e17f72";
const ABC_SHA1: &str = "a9993e364706816aba3e25717850c26c9cd0d89d";
const ABC_SHA256: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const ABC_CRC32: &str = "352441c2";

#[test]
fn computes_known_vectors_for_all_algorithms() {
    let dir = temp_dir();
    let file = dir.join("abc.txt");
    std::fs::write(&file, b"abc").unwrap();
    let cancel = AtomicBool::new(false);
    let algorithms = [
        ChecksumAlgorithm::Crc32,
        ChecksumAlgorithm::Md5,
        ChecksumAlgorithm::Sha1,
        ChecksumAlgorithm::Sha256,
    ];

    let hashes = hash_file(&file, &algorithms, &cancel).unwrap();

    let values: Vec<&str> = hashes.iter().map(|(_, value)| value.as_str()).collect();
    assert_eq!(values, vec![ABC_CRC32, ABC_MD5, ABC_SHA1, ABC_SHA256]);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn hashes_empty_file() {
    let dir = temp_dir();
    let file = dir.join("empty");
    std::fs::write(&file, b"").unwrap();
    let hashes = hash_file(&file, &[ChecksumAlgorithm::Md5], &AtomicBool::new(false)).unwrap();
    assert_eq!(hashes[0].1, "d41d8cd98f00b204e9800998ecf8427e");
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn cancelled_flag_stops_hashing() {
    let dir = temp_dir();
    let file = dir.join("abc.txt");
    std::fs::write(&file, b"abc").unwrap();
    let result = hash_file(&file, &[ChecksumAlgorithm::Md5], &AtomicBool::new(true));
    assert_eq!(result.unwrap_err(), CHECKSUM_CANCELLED);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn compute_reports_folder_and_missing_file_as_per_file_errors() {
    let dir = temp_dir();
    let results = compute_checksums_blocking(
        vec![
            dir.to_string_lossy().into_owned(),
            dir.join("nope").to_string_lossy().into_owned(),
        ],
        vec![ChecksumAlgorithm::Md5],
        &AtomicBool::new(false),
    )
    .unwrap();
    assert_eq!(results.len(), 2);
    assert!(results.iter().all(|result| result.error.is_some()));
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn parses_gnu_bsd_and_sfv_lines() {
    let gnu = parse_checksum_text(
        &format!("# comment\n{ABC_MD5} *a.bin\n{ABC_SHA256}  dir/b.bin\nnot a checksum line\n"),
        false,
    );
    assert_eq!(gnu.len(), 2);
    assert_eq!(gnu[0].algorithm, ChecksumAlgorithm::Md5);
    assert_eq!(gnu[0].name, "a.bin");
    assert_eq!(gnu[1].algorithm, ChecksumAlgorithm::Sha256);
    assert_eq!(gnu[1].name, "dir/b.bin");

    let bsd = parse_checksum_text(
        &format!("SHA-1 (a b.txt) = {}\n", ABC_SHA1.to_uppercase()),
        false,
    );
    assert_eq!(bsd.len(), 1);
    assert_eq!(bsd[0].algorithm, ChecksumAlgorithm::Sha1);
    assert_eq!(bsd[0].name, "a b.txt");
    assert_eq!(bsd[0].expected, ABC_SHA1);

    let sfv = parse_checksum_text(&format!("; header\nfile one.txt {ABC_CRC32}\n"), true);
    assert_eq!(sfv.len(), 1);
    assert_eq!(sfv[0].name, "file one.txt");
    assert_eq!(sfv[0].algorithm, ChecksumAlgorithm::Crc32);
}

#[test]
fn rejects_paths_outside_checksum_folder() {
    let base = Path::new("/tmp/base");
    assert!(resolve_listed_path(base, "../secret").is_err());
    assert!(resolve_listed_path(base, "/etc/passwd").is_err());
    assert!(resolve_listed_path(base, "sub/file.txt").is_ok());
}

#[test]
fn verifies_ok_mismatch_missing_entries() {
    let dir = temp_dir();
    std::fs::write(dir.join("good.txt"), b"abc").unwrap();
    std::fs::write(dir.join("bad.txt"), b"abd").unwrap();
    let list = dir.join("sums.md5");
    std::fs::write(
        &list,
        format!("{ABC_MD5} *good.txt\n{ABC_MD5} *bad.txt\n{ABC_MD5} *gone.txt\n{ABC_MD5} *../x\n"),
    )
    .unwrap();

    let entries =
        verify_checksum_file_blocking(list.to_string_lossy().into_owned(), &AtomicBool::new(false))
            .unwrap();

    let statuses: Vec<&str> = entries.iter().map(|entry| entry.status.as_str()).collect();
    assert_eq!(statuses, vec!["ok", "mismatch", "missing", "error"]);
    assert!(entries[1].actual.is_some());
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn verify_fails_when_no_entries_recognized() {
    let dir = temp_dir();
    let list = dir.join("junk.txt");
    std::fs::write(&list, "hello\nworld\n").unwrap();
    let result =
        verify_checksum_file_blocking(list.to_string_lossy().into_owned(), &AtomicBool::new(false));
    assert!(result.is_err());
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn duplicate_job_id_is_rejected_until_guard_drops() {
    let first = CancelGuard::register("dup-job").unwrap();
    assert!(CancelGuard::register("dup-job").is_err());
    drop(first);
    assert!(CancelGuard::register("dup-job").is_ok());
}
