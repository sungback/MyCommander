use std::fs;
use std::path::Path;

use serde::Serialize;

const DEFAULT_ESTIMATE_MAX_DEPTH: usize = 1;
const DEFAULT_ESTIMATE_MAX_ENTRIES: usize = 200;
const MAX_ESTIMATE_DEPTH: usize = 4;
const MAX_ESTIMATE_ENTRIES: usize = 5_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeEstimate {
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
}

pub async fn get_dir_size(path: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || compute_path_size(&path))
        .await
        .map_err(|e| e.to_string())?
}

pub async fn estimate_dir_size(
    path: String,
    max_depth: Option<usize>,
    max_entries: Option<usize>,
) -> Result<DirectorySizeEstimate, String> {
    tokio::task::spawn_blocking(move || {
        estimate_path_size(
            &path,
            max_depth.unwrap_or(DEFAULT_ESTIMATE_MAX_DEPTH),
            max_entries.unwrap_or(DEFAULT_ESTIMATE_MAX_ENTRIES),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(crate) fn compute_path_size(path: &str) -> Result<u64, String> {
    let target = Path::new(path);
    if !target.exists() {
        return Err(format!("{path} does not exist"));
    }

    if target.is_file() {
        return fs::metadata(target)
            .map(|metadata| metadata.len())
            .map_err(|e| e.to_string());
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    if let Ok(size) = get_dir_size_with_du(path) {
        return Ok(size);
    }

    get_dir_size_with_walkdir(path)
}

pub(crate) fn estimate_path_size(
    path: &str,
    max_depth: usize,
    max_entries: usize,
) -> Result<DirectorySizeEstimate, String> {
    let target = Path::new(path);
    let metadata = fs::symlink_metadata(target).map_err(|e| e.to_string())?;
    let max_depth = max_depth.min(MAX_ESTIMATE_DEPTH);
    let max_entries = max_entries.clamp(1, MAX_ESTIMATE_ENTRIES);
    let mut estimate = DirectorySizeEstimate {
        size: 0,
        is_partial: false,
        scanned_entries: 0,
    };

    if metadata.is_file() || metadata.file_type().is_symlink() {
        estimate.size = metadata.len();
        estimate.scanned_entries = 1;
        return Ok(estimate);
    }

    if !metadata.is_dir() {
        return Ok(estimate);
    }

    scan_estimate_dir(target, 0, max_depth, max_entries, &mut estimate);
    Ok(estimate)
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn get_dir_size_with_du(path: &str) -> Result<u64, String> {
    use std::process::Command;

    let output = Command::new("du")
        .arg("-sk")
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed_size = parse_du_size_bytes(&stdout);
    if let Some(size) = parsed_size {
        return Ok(size);
    }

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Err("Failed to parse `du` output".to_string())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn parse_du_size_bytes(stdout: &str) -> Option<u64> {
    stdout
        .split_whitespace()
        .next()?
        .parse::<u64>()
        .ok()
        .map(|size_kb| size_kb.saturating_mul(1024))
}

fn get_dir_size_with_walkdir(path: &str) -> Result<u64, String> {
    use walkdir::WalkDir;

    let mut total_size = 0;
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();
            }
        }
    }

    Ok(total_size)
}

fn scan_estimate_dir(
    path: &Path,
    depth: usize,
    max_depth: usize,
    max_entries: usize,
    estimate: &mut DirectorySizeEstimate,
) {
    if estimate.scanned_entries >= max_entries {
        estimate.is_partial = true;
        return;
    }

    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => {
            estimate.is_partial = true;
            return;
        }
    };

    for entry in entries {
        if estimate.scanned_entries >= max_entries {
            estimate.is_partial = true;
            break;
        }

        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                estimate.is_partial = true;
                continue;
            }
        };

        estimate.scanned_entries += 1;
        let metadata = match fs::symlink_metadata(entry.path()) {
            Ok(metadata) => metadata,
            Err(_) => {
                estimate.is_partial = true;
                continue;
            }
        };

        if metadata.is_file() || metadata.file_type().is_symlink() {
            estimate.size = estimate.size.saturating_add(metadata.len());
            continue;
        }

        if metadata.is_dir() {
            if depth >= max_depth {
                estimate.is_partial = true;
                continue;
            }

            scan_estimate_dir(&entry.path(), depth + 1, max_depth, max_entries, estimate);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::estimate_path_size;
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    use super::parse_du_size_bytes;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn parse_du_size_bytes_reads_summary_even_with_other_output() {
        assert_eq!(parse_du_size_bytes("42\t/Users/example\n"), Some(43_008));
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn parse_du_size_bytes_returns_none_for_unparseable_output() {
        assert_eq!(parse_du_size_bytes(""), None);
        assert_eq!(parse_du_size_bytes("du: cannot read directory"), None);
    }

    #[test]
    fn estimate_path_size_reads_files_within_depth_limit() {
        let root = make_temp_dir("estimate-depth");
        let child = root.join("child");
        fs::create_dir_all(&child).unwrap();
        fs::write(root.join("root.bin"), [1_u8; 10]).unwrap();
        fs::write(child.join("child.bin"), [1_u8; 20]).unwrap();

        let estimate = estimate_path_size(root.to_str().unwrap(), 1, 100).unwrap();

        assert_eq!(estimate.size, 30);
        assert!(!estimate.is_partial);
        assert_eq!(estimate.scanned_entries, 3);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn estimate_path_size_marks_unscanned_children_partial() {
        let root = make_temp_dir("estimate-partial");
        let child = root.join("child");
        fs::create_dir_all(&child).unwrap();
        fs::write(child.join("child.bin"), [1_u8; 20]).unwrap();

        let estimate = estimate_path_size(root.to_str().unwrap(), 0, 100).unwrap();

        assert_eq!(estimate.size, 0);
        assert!(estimate.is_partial);
        assert_eq!(estimate.scanned_entries, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn estimate_path_size_marks_entry_limit_partial() {
        let root = make_temp_dir("estimate-limit");
        fs::write(root.join("a.bin"), [1_u8; 10]).unwrap();
        fs::write(root.join("b.bin"), [1_u8; 20]).unwrap();

        let estimate = estimate_path_size(root.to_str().unwrap(), 1, 1).unwrap();

        assert!(estimate.is_partial);
        assert_eq!(estimate.scanned_entries, 1);

        fs::remove_dir_all(root).unwrap();
    }

    fn make_temp_dir(label: &str) -> std::path::PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("mycommander-{label}-{id}"));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
