use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;

use super::scan::scan_path_size_with_progress;
use super::types::DirectorySizeEstimate;

pub(super) const DEFAULT_ESTIMATE_MAX_DEPTH: usize = 1;
pub(super) const DEFAULT_ESTIMATE_MAX_ENTRIES: usize = 200;
const MAX_ESTIMATE_DEPTH: usize = 4;
const MAX_ESTIMATE_ENTRIES: usize = 5_000;

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

    if metadata.is_file() {
        estimate.size = metadata.len();
        estimate.scanned_entries = 1;
        return Ok(estimate);
    }

    if should_skip_directory_traversal(&metadata) {
        estimate.is_partial = true;
        estimate.scanned_entries = 1;
        return Ok(estimate);
    }

    if !metadata.is_dir() {
        return Ok(estimate);
    }

    scan_estimate_dir(target, 0, max_depth, max_entries, &mut estimate);
    Ok(estimate)
}

pub(super) fn should_skip_directory_traversal(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink() || is_windows_reparse_point(metadata)
}

#[cfg(target_os = "windows")]
fn is_windows_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0000_0400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(target_os = "windows"))]
fn is_windows_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub(super) fn get_dir_size_with_du(path: &str) -> Result<u64, String> {
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
pub(super) fn parse_du_size_bytes(stdout: &str) -> Option<u64> {
    stdout
        .split_whitespace()
        .next()?
        .parse::<u64>()
        .ok()
        .map(|size_kb| size_kb.saturating_mul(1024))
}

fn get_dir_size_with_walkdir(path: &str) -> Result<u64, String> {
    let cancel_flag = AtomicBool::new(false);
    scan_path_size_with_progress(path, &cancel_flag, |_| {}).map(|result| result.size)
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

        if metadata.is_file() {
            estimate.size = estimate.size.saturating_add(metadata.len());
            continue;
        }

        if should_skip_directory_traversal(&metadata) {
            estimate.is_partial = true;
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
