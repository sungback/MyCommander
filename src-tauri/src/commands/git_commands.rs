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

    #[test]
    fn git_status_returns_none_when_git_cannot_start() {
        let result =
            get_git_status_with_runner("/repo", |_, _| Err(io::Error::other("git.exe failed")))
                .unwrap();

        assert!(result.is_none());
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
    let root_output = match run_git(path, &["rev-parse", "--show-toplevel"]) {
        Ok(output) => output,
        Err(_) => return Ok(None),
    };

    if !root_output.status.success() {
        // Not a git repository
        return Ok(None);
    }

    let git_root = String::from_utf8_lossy(&root_output.stdout)
        .trim()
        .to_string();

    // Calculate relative path prefix from git root to current path
    let rel_prefix = {
        let path_clean = path.trim_end_matches('/');
        let root_clean = git_root.trim_end_matches('/');

        if path_clean != root_clean && path_clean.starts_with(root_clean) {
            let rel = &path_clean[root_clean.len()..].trim_start_matches('/');
            if !rel.is_empty() {
                format!("{}/", rel.replace('\\', "/"))
            } else {
                String::new()
            }
        } else {
            String::new()
        }
    };

    // Get git status with porcelain format
    let status_output = match run_git(path, &["status", "--porcelain", "--branch"]) {
        Ok(output) => output,
        Err(_) => return Ok(None),
    };

    if !status_output.status.success() {
        return Ok(None);
    }

    let status_str = String::from_utf8_lossy(&status_output.stdout);
    let lines: Vec<&str> = status_str.lines().collect();

    let mut branch = "unknown".to_string();
    let mut modified = Vec::new();
    let mut added = Vec::new();
    let mut deleted = Vec::new();
    let mut untracked = Vec::new();

    // Helper to strip rel_prefix from paths
    let relativize = |p: String| -> String {
        if rel_prefix.is_empty() {
            p
        } else if p.starts_with(&rel_prefix) {
            p[rel_prefix.len()..].to_string()
        } else {
            p
        }
    };

    for line in lines {
        // Parse branch from "## main...origin/main" or "## HEAD"
        if let Some(branch_info) = line.strip_prefix("## ") {
            branch = branch_info
                .split("...")
                .next()
                .unwrap_or(branch_info)
                .trim()
                .to_string();
        } else if line.len() >= 3 {
            let status_code = &line[0..2];
            let file_path = line[3..].to_string();

            // Match both index and worktree states
            let c1 = status_code.chars().next();
            let c2 = status_code.chars().nth(1);

            match (c1, c2) {
                (Some('M'), _) | (_, Some('M')) => modified.push(relativize(file_path)),
                (Some('A'), _) | (_, Some('A')) => added.push(relativize(file_path)),
                (Some('D'), _) | (_, Some('D')) => deleted.push(relativize(file_path)),
                (Some('?'), Some('?')) => untracked.push(relativize(file_path)),
                _ => {}
            }
        }
    }

    Ok(Some(GitStatus {
        branch,
        modified,
        added,
        deleted,
        untracked,
    }))
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
