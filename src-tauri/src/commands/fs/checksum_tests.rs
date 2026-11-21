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
        &mut ProgressReporter::none(),
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

    let entries = verify_checksum_file_blocking(
        list.to_string_lossy().into_owned(),
        &AtomicBool::new(false),
        &mut ProgressReporter::none(),
    )
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
    let result = verify_checksum_file_blocking(
        list.to_string_lossy().into_owned(),
        &AtomicBool::new(false),
        &mut ProgressReporter::none(),
    );
    assert!(result.is_err());
    std::fs::remove_dir_all(dir).unwrap();
}

fn collecting_reporter(file_count: usize) -> (ProgressReporter, Arc<Mutex<Vec<ChecksumProgress>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let sink_events = events.clone();
    let sink: ProgressSink = Box::new(move |progress| sink_events.lock().unwrap().push(progress));
    (
        ProgressReporter::with_sink(Some(sink), "job-1".to_string(), file_count),
        events,
    )
}

#[test]
fn compute_reports_progress_per_file_and_ends_at_full_size() {
    let dir = temp_dir();
    std::fs::write(dir.join("a.bin"), vec![1u8; 3000]).unwrap();
    std::fs::write(dir.join("b.bin"), b"abc").unwrap();
    let (mut reporter, events) = collecting_reporter(2);

    compute_checksums_blocking(
        vec![
            dir.join("a.bin").to_string_lossy().into_owned(),
            dir.join("b.bin").to_string_lossy().into_owned(),
        ],
        vec![ChecksumAlgorithm::Md5],
        &AtomicBool::new(false),
        &mut reporter,
    )
    .unwrap();

    let events = events.lock().unwrap();
    let last_for = |index: usize| {
        events
            .iter()
            .rev()
            .find(|event| event.file_index == index)
            .cloned()
            .expect("progress for file")
    };
    let first = last_for(1);
    assert_eq!(first.file_name, "a.bin");
    assert_eq!((first.bytes_done, first.bytes_total), (3000, 3000));
    assert_eq!(first.file_count, 2);
    assert_eq!(first.job_id, "job-1");
    let second = last_for(2);
    assert_eq!(second.file_name, "b.bin");
    assert_eq!((second.bytes_done, second.bytes_total), (3, 3));
    // 첫 이벤트는 0바이트에서 시작한다.
    assert_eq!(events.first().unwrap().bytes_done, 0);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn progress_events_are_throttled_but_start_and_end_always_emit() {
    let dir = temp_dir();
    // 1MiB 버퍼로 여러 번 읽도록 3MiB 파일을 만든다. 읽기가 100ms보다 훨씬 빨라 중간 이벤트는 걸러진다.
    std::fs::write(dir.join("big.bin"), vec![7u8; 3 * 1024 * 1024]).unwrap();
    let (mut reporter, events) = collecting_reporter(1);

    compute_checksums_blocking(
        vec![dir.join("big.bin").to_string_lossy().into_owned()],
        vec![ChecksumAlgorithm::Crc32],
        &AtomicBool::new(false),
        &mut reporter,
    )
    .unwrap();

    let events = events.lock().unwrap();
    assert!(events.len() >= 2, "start and end must always be emitted");
    assert!(
        events.len() < 6,
        "intermediate events should be throttled: {}",
        events.len()
    );
    let last = events.last().unwrap();
    assert_eq!(last.bytes_done, last.bytes_total);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn verify_reports_progress_for_each_listed_file() {
    let dir = temp_dir();
    std::fs::write(dir.join("good.txt"), b"abc").unwrap();
    let list = dir.join("sums.md5");
    std::fs::write(&list, format!("{ABC_MD5} *good.txt\n{ABC_MD5} *gone.txt\n")).unwrap();
    let (mut reporter, events) = collecting_reporter(0);

    verify_checksum_file_blocking(
        list.to_string_lossy().into_owned(),
        &AtomicBool::new(false),
        &mut reporter,
    )
    .unwrap();

    let events = events.lock().unwrap();
    assert!(events.iter().all(|event| event.file_count == 2));
    assert!(events
        .iter()
        .any(|event| event.file_name == "good.txt" && event.bytes_done == 3));
    // 없는 파일은 읽지 않으므로 진행 이벤트가 없다.
    assert!(events.iter().all(|event| event.file_name != "gone.txt"));
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn duplicate_job_id_is_rejected_until_guard_drops() {
    let first = CancelGuard::register("dup-job").unwrap();
    assert!(CancelGuard::register("dup-job").is_err());
    drop(first);
    assert!(CancelGuard::register("dup-job").is_ok());
}
