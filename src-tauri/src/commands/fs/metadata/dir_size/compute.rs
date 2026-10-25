use std::fs;
use std::path::Path;

use super::scan::{
    counted_file_size, entry_metadata, is_data_volume_mirror, HardLinkTracker, VolumeBoundary,
};
use super::types::DirectorySizeEstimate;

pub(super) const DEFAULT_ESTIMATE_MAX_DEPTH: usize = 1;
pub(super) const DEFAULT_ESTIMATE_MAX_ENTRIES: usize = 200;
const MAX_ESTIMATE_DEPTH: usize = 4;
const MAX_ESTIMATE_ENTRIES: usize = 5_000;

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
        estimate.size = counted_file_size(&metadata);
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

    let mut hard_links = HardLinkTracker::default();
    let volume = VolumeBoundary::new(&metadata);
    scan_estimate_dir(
        target,
        0,
        max_depth,
        max_entries,
        &mut estimate,
        &mut hard_links,
        &volume,
    );
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

fn scan_estimate_dir(
    path: &Path,
    depth: usize,
    max_depth: usize,
    max_entries: usize,
    estimate: &mut DirectorySizeEstimate,
    hard_links: &mut HardLinkTracker,
    volume: &VolumeBoundary,
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
        let metadata = match entry_metadata(&entry) {
            Ok(metadata) => metadata,
            Err(_) => {
                estimate.is_partial = true;
                continue;
            }
        };

        if metadata.is_file() {
            if hard_links.should_count(&metadata) {
                estimate.size = estimate.size.saturating_add(counted_file_size(&metadata));
            }
            continue;
        }

        if should_skip_directory_traversal(&metadata) {
            estimate.is_partial = true;
            continue;
        }

        if !volume.contains(&metadata) || is_data_volume_mirror(&entry.path()) {
            continue;
        }

        if metadata.is_dir() {
            if depth >= max_depth {
                estimate.is_partial = true;
                continue;
            }

            scan_estimate_dir(
                &entry.path(),
                depth + 1,
                max_depth,
                max_entries,
                estimate,
                hard_links,
                volume,
            );
        }
    }
}
