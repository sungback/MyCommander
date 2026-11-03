use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

// 병렬 테스트가 같은 시각을 읽어도 폴더 이름이 겹치지 않도록 호출마다 번호를 붙인다
static DIRECTORY_COUNTER: AtomicUsize = AtomicUsize::new(0);

fn test_directory() -> PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let counter = DIRECTORY_COUNTER.fetch_add(1, Ordering::Relaxed);
    let path = std::env::temp_dir().join(format!("mycommander_trash_{suffix}_{counter}"));
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn native_trash_success_does_not_request_finder_access() {
    let mut calls = 0;
    let result = move_to_trash_with_methods(Path::new("unused"), |_, method| {
        calls += 1;
        assert!(matches!(method, DeleteMethod::NsFileManager));
        Ok(())
    });

    assert_eq!(result, Ok(()));
    assert_eq!(calls, 1);
}

#[test]
fn native_permission_failure_retries_the_same_path_through_finder() {
    let directory = test_directory();
    let path = directory.join("한글 \"quoted\" \\ file.png");
    fs::write(&path, b"keep contents").unwrap();
    let mut calls = 0;

    let result = move_to_trash_with_methods(&path, |actual_path, method| {
        calls += 1;
        assert_eq!(actual_path, path);
        match method {
            DeleteMethod::NsFileManager => Err("permission denied".into()),
            DeleteMethod::Finder => Ok(()),
        }
    });

    assert_eq!(result, Ok(()));
    assert_eq!(calls, 2);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn both_trash_failures_preserve_the_file_and_report_both_errors() {
    let directory = test_directory();
    let path = directory.join("file.png");
    fs::write(&path, b"keep contents").unwrap();

    let result = move_to_trash_with_methods(&path, |_, method| match method {
        DeleteMethod::NsFileManager => Err("native permission denied".into()),
        DeleteMethod::Finder => Err("automation denied".into()),
    });

    let error = result.unwrap_err();
    assert!(error.contains("native permission denied"));
    assert!(error.contains("automation denied"));
    assert!(error.contains("Privacy & Security"));
    assert_eq!(fs::read(&path).unwrap(), b"keep contents");
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn missing_entry_is_not_retried_through_finder() {
    let directory = test_directory();
    let mut calls = 0;

    let result = move_to_trash_with_methods(&directory.join("missing"), |_, method| {
        calls += 1;
        assert!(matches!(method, DeleteMethod::NsFileManager));
        Err("native failure".into())
    });

    assert_eq!(result, Err("native failure".into()));
    assert_eq!(calls, 1);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn non_utf8_path_is_not_retried_as_a_different_percent_encoded_name() {
    use std::os::unix::ffi::OsStringExt;

    // APFS rejects invalid UTF-8 on disk; exercise this path guard in memory.
    let path = PathBuf::from(std::ffi::OsString::from_vec(b"file-\xff".to_vec()));
    let mut calls = 0;

    let result = move_to_trash_with_methods(&path, |_, method| {
        calls += 1;
        assert!(matches!(method, DeleteMethod::NsFileManager));
        Err("native failure".into())
    });

    assert_eq!(result, Err("native failure".into()));
    assert_eq!(calls, 1);
}

#[test]
fn finder_retry_preserves_symlink_paths_including_broken_links() {
    let directory = test_directory();
    let target = directory.join("target");
    fs::write(&target, b"keep target").unwrap();

    for name in ["target", "missing-target"] {
        let link = directory.join(format!("{name}-link"));
        std::os::unix::fs::symlink(directory.join(name), &link).unwrap();
        let mut calls = 0;
        let result = move_to_trash_with_methods(&link, |actual_path, method| {
            calls += 1;
            assert_eq!(actual_path, link);
            match method {
                DeleteMethod::NsFileManager => Err("native failure".into()),
                DeleteMethod::Finder => Ok(()),
            }
        });
        assert_eq!(result, Ok(()));
        assert_eq!(calls, 2);
    }

    assert_eq!(fs::read(&target).unwrap(), b"keep target");
    fs::remove_dir_all(directory).unwrap();
}

// 아래 두 테스트는 실제 휴지통을 사용하므로 기본 실행에서 제외한다.
// 실행: cargo test --lib real_ -- --ignored --test-threads=1
// 휴지통에 작은 파일이 남으므로 확인 후 직접 비운다.

#[test]
#[ignore = "실제 휴지통에 파일을 보낸다"]
fn real_move_to_trash_removes_the_file() {
    let directory = test_directory();
    let path = directory.join("mycommander_real_trash_test.txt");
    fs::write(&path, b"trash me").unwrap();

    let result = move_to_trash(&path);

    assert_eq!(result, Ok(()));
    assert!(!path.exists());
    fs::remove_dir_all(directory).unwrap();
}

#[test]
#[ignore = "Finder 자동화 권한 창이 뜰 수 있다"]
fn real_finder_method_moves_the_file_to_trash() {
    let directory = test_directory();
    let path = directory.join("mycommander_real_finder_test.txt");
    fs::write(&path, b"trash me via finder").unwrap();

    let mut ctx = trash::TrashContext::new();
    ctx.set_delete_method(DeleteMethod::Finder);
    let result = ctx.delete(&path);

    assert!(result.is_ok(), "Finder 휴지통 이동 실패: {result:?}");
    assert!(!path.exists());
    fs::remove_dir_all(directory).unwrap();
}
