use serde::Serialize;
use tokio::process::Command;

#[derive(Serialize, Debug, Clone)]
pub struct GitStatus {
    pub branch: String,
    pub modified: Vec<String>,
    pub added: Vec<String>,
    pub deleted: Vec<String>,
    pub untracked: Vec<String>,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_git_status(path: String) -> Result<Option<GitStatus>, String> {
    // Check if path is a git repository
    let root_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("rev-parse")
        .arg("--show-toplevel")
        .output()
        .await
        .map_err(|e| format!("Failed to check git root: {}", e))?;

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
    let status_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("status")
        .arg("--porcelain")
        .arg("--branch")
        .output()
        .await
        .map_err(|e| format!("Failed to get git status: {}", e))?;

    if !status_output.status.success() {
        return Err(format!(
            "Git status failed: {}",
            String::from_utf8_lossy(&status_output.stderr)
        ));
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
