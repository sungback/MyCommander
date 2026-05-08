use super::status::get_git_status_with_runner;
use std::io;
use std::process::{ExitStatus, Output};

#[cfg(unix)]
fn success_status() -> ExitStatus {
    use std::os::unix::process::ExitStatusExt;

    ExitStatus::from_raw(0)
}

#[cfg(windows)]
fn success_status() -> ExitStatus {
    use std::os::windows::process::ExitStatusExt;

    ExitStatus::from_raw(0)
}

fn success_output(stdout: &str) -> Output {
    Output {
        status: success_status(),
        stdout: stdout.as_bytes().to_vec(),
        stderr: Vec::new(),
    }
}

#[test]
fn git_status_returns_none_when_git_cannot_start() {
    let result =
        get_git_status_with_runner("/repo", |_, _| Err(io::Error::other("git.exe failed")))
            .unwrap();

    assert!(result.is_none());
}

#[test]
fn git_status_parses_branch_and_relativizes_paths_from_subdirectory() {
    let outputs = [
        success_output("/repo\n"),
        success_output(
            "## main...origin/main\n M src/app.rs\nA  src/new.rs\n D src/old.rs\n?? src/tmp.txt\n",
        ),
    ];
    let mut output_iter = outputs.into_iter();

    let result = get_git_status_with_runner("/repo/src", |_, _| {
        output_iter
            .next()
            .ok_or_else(|| io::Error::other("unexpected git call"))
    })
    .unwrap()
    .unwrap();

    assert_eq!(result.branch, "main");
    assert_eq!(result.modified, vec!["app.rs"]);
    assert_eq!(result.added, vec!["new.rs"]);
    assert_eq!(result.deleted, vec!["old.rs"]);
    assert_eq!(result.untracked, vec!["tmp.txt"]);
}

#[test]
fn git_status_keeps_head_branch_name_without_upstream() {
    let outputs = [
        success_output("/repo\n"),
        success_output("## HEAD (no branch)\n M README.md\n"),
    ];
    let mut output_iter = outputs.into_iter();

    let result = get_git_status_with_runner("/repo", |_, _| {
        output_iter
            .next()
            .ok_or_else(|| io::Error::other("unexpected git call"))
    })
    .unwrap()
    .unwrap();

    assert_eq!(result.branch, "HEAD (no branch)");
    assert_eq!(result.modified, vec!["README.md"]);
}

#[test]
fn background_git_source_hides_windows_process_errors() {
    let source = include_str!("runner.rs");

    assert!(source.contains("CREATE_NO_WINDOW"));
    assert!(source.contains("SetThreadErrorMode"));
    assert!(source.contains("SEM_NOGPFAULTERRORBOX"));
}
