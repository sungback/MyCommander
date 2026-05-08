use serde::Serialize;
use std::io;
use std::process::{Command, Output};

#[derive(Serialize, Debug, Clone)]
pub struct GitStatus {
    pub branch: String,
    pub modified: Vec<String>,
    pub added: Vec<String>,
    pub deleted: Vec<String>,
    pub untracked: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
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
        let source = include_str!("git_commands.rs");

        assert!(source.contains("CREATE_NO_WINDOW"));
        assert!(source.contains("SetThreadErrorMode"));
        assert!(source.contains("SEM_NOGPFAULTERRORBOX"));
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_git_status(path: String) -> Result<Option<GitStatus>, String> {
    tokio::task::spawn_blocking(move || get_git_status_for_path(&path))
        .await
        .map_err(|error| error.to_string())?
}

fn get_git_status_for_path(path: &str) -> Result<Option<GitStatus>, String> {
    get_git_status_with_runner(path, run_background_git)
}

fn get_git_status_with_runner<F>(path: &str, mut run_git: F) -> Result<Option<GitStatus>, String>
where
    F: FnMut(&str, &[&str]) -> io::Result<Output>,
{
    let root_output =
        match run_successful_git_command(&mut run_git, path, &["rev-parse", "--show-toplevel"]) {
            Some(output) => output,
            None => return Ok(None),
        };
    let git_root = git_output_to_trimmed_string(&root_output);
    let rel_prefix = git_relative_prefix(path, &git_root);

    let status_output = match run_successful_git_command(
        &mut run_git,
        path,
        &["status", "--porcelain", "--branch"],
    ) {
        Some(output) => output,
        None => return Ok(None),
    };

    Ok(Some(parse_git_status_output(
        &status_output.stdout,
        &rel_prefix,
    )))
}

fn run_successful_git_command<F>(run_git: &mut F, path: &str, args: &[&str]) -> Option<Output>
where
    F: FnMut(&str, &[&str]) -> io::Result<Output>,
{
    run_git(path, args)
        .ok()
        .filter(|output| output.status.success())
}

fn git_output_to_trimmed_string(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

fn git_relative_prefix(path: &str, git_root: &str) -> String {
    let path_clean = path.trim_end_matches('/');
    let root_clean = git_root.trim_end_matches('/');

    if path_clean == root_clean {
        return String::new();
    }

    let Some(rel) = path_clean.strip_prefix(root_clean) else {
        return String::new();
    };
    let rel = rel.trim_start_matches('/');

    if rel.is_empty() {
        String::new()
    } else {
        format!("{}/", rel.replace('\\', "/"))
    }
}

fn parse_git_status_output(stdout: &[u8], rel_prefix: &str) -> GitStatus {
    let status_str = String::from_utf8_lossy(stdout);
    let mut status = GitStatus {
        branch: "unknown".to_string(),
        modified: Vec::new(),
        added: Vec::new(),
        deleted: Vec::new(),
        untracked: Vec::new(),
    };

    for line in status_str.lines() {
        if let Some(branch_info) = line.strip_prefix("## ") {
            status.branch = parse_branch_name(branch_info);
            continue;
        }

        let Some(((index_status, worktree_status), file_path)) = parse_porcelain_status_line(line)
        else {
            continue;
        };
        let file_path = relativize_git_path(file_path, rel_prefix);

        match (index_status, worktree_status) {
            ('M', _) | (_, 'M') => status.modified.push(file_path),
            ('A', _) | (_, 'A') => status.added.push(file_path),
            ('D', _) | (_, 'D') => status.deleted.push(file_path),
            ('?', '?') => status.untracked.push(file_path),
            _ => {}
        }
    }

    status
}

fn parse_branch_name(branch_info: &str) -> String {
    branch_info
        .split_once("...")
        .map_or(branch_info, |(branch, _)| branch)
        .trim()
        .to_string()
}

fn parse_porcelain_status_line(line: &str) -> Option<((char, char), &str)> {
    let mut chars = line.chars();
    let index_status = chars.next()?;
    let worktree_status = chars.next()?;
    chars.next()?;

    Some(((index_status, worktree_status), chars.as_str()))
}

fn relativize_git_path(path: &str, rel_prefix: &str) -> String {
    path.strip_prefix(rel_prefix).unwrap_or(path).to_string()
}

fn run_background_git(path: &str, args: &[&str]) -> io::Result<Output> {
    let mut command = Command::new("git");
    command.arg("-C").arg(path).args(args);
    configure_background_command(&mut command);

    let _error_mode_guard = WindowsThreadErrorModeGuard::suppress_process_error_dialogs();
    command.output()
}

fn configure_background_command(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = command;
    }
}

#[cfg(target_os = "windows")]
struct WindowsThreadErrorModeGuard {
    previous_mode: Option<u32>,
}

#[cfg(target_os = "windows")]
impl WindowsThreadErrorModeGuard {
    fn suppress_process_error_dialogs() -> Self {
        const SEM_FAILCRITICALERRORS: u32 = 0x0001;
        const SEM_NOGPFAULTERRORBOX: u32 = 0x0002;
        const SEM_NOOPENFILEERRORBOX: u32 = 0x8000;

        let mut previous_mode = 0;
        let applied = unsafe {
            SetThreadErrorMode(
                SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX,
                &mut previous_mode,
            )
        } != 0;

        Self {
            previous_mode: applied.then_some(previous_mode),
        }
    }
}

#[cfg(target_os = "windows")]
impl Drop for WindowsThreadErrorModeGuard {
    fn drop(&mut self) {
        if let Some(previous_mode) = self.previous_mode {
            unsafe {
                SetThreadErrorMode(previous_mode, std::ptr::null_mut());
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
struct WindowsThreadErrorModeGuard;

#[cfg(not(target_os = "windows"))]
impl WindowsThreadErrorModeGuard {
    fn suppress_process_error_dialogs() -> Self {
        Self
    }
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn SetThreadErrorMode(dw_new_mode: u32, lp_old_mode: *mut u32) -> i32;
}
