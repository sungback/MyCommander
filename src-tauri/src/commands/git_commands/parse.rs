use super::types::GitStatus;
use std::process::Output;

pub(super) fn git_output_to_trimmed_string(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

pub(super) fn git_relative_prefix(path: &str, git_root: &str) -> String {
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

pub(super) fn parse_git_status_output(stdout: &[u8], rel_prefix: &str) -> GitStatus {
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
