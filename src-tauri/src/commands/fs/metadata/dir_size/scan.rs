use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use super::compute::{is_same_filesystem, metadata_device, should_skip_directory_traversal};
use super::types::DirectorySizeScanResult;

const SCAN_PROGRESS_INTERVAL: Duration = Duration::from_millis(200);
const SCAN_PROGRESS_ENTRY_INTERVAL: usize = 256;

#[derive(Debug, Clone, Copy)]
pub(super) struct ScanProgress {
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
    pub completed: bool,
}

struct ScanAccumulator {
    size: u64,
    is_partial: bool,
    scanned_entries: usize,
    error_count: usize,
    last_emit_at: Instant,
    entries_since_emit: usize,
}

impl ScanAccumulator {
    fn new() -> Self {
        Self {
            size: 0,
            is_partial: false,
            scanned_entries: 0,
            error_count: 0,
            last_emit_at: Instant::now(),
            entries_since_emit: 0,
        }
    }

    fn mark_partial(&mut self) {
        self.is_partial = true;
        self.error_count = self.error_count.saturating_add(1);
    }

    fn progress(&self, completed: bool) -> ScanProgress {
        ScanProgress {
            size: self.size,
            is_partial: self.is_partial,
            scanned_entries: self.scanned_entries,
            completed,
        }
    }

    fn maybe_emit<F>(&mut self, completed: bool, emit_progress: &mut F)
    where
        F: FnMut(ScanProgress),
    {
        if !completed
            && self.entries_since_emit < SCAN_PROGRESS_ENTRY_INTERVAL
            && self.last_emit_at.elapsed() < SCAN_PROGRESS_INTERVAL
        {
            return;
        }

        emit_progress(self.progress(completed));
        self.entries_since_emit = 0;
        self.last_emit_at = Instant::now();
    }

    fn into_result(self) -> DirectorySizeScanResult {
        DirectorySizeScanResult {
            size: self.size,
            is_partial: self.is_partial,
            scanned_entries: self.scanned_entries,
            error_count: self.error_count,
        }
    }
}

pub(crate) fn scan_path_size_with_progress<F>(
    path: &str,
    cancel_flag: &AtomicBool,
    mut emit_progress: F,
) -> Result<DirectorySizeScanResult, String>
where
    F: FnMut(ScanProgress),
{
    let target = Path::new(path);
    let metadata = fs::symlink_metadata(target).map_err(|e| e.to_string())?;
    let mut accumulator = ScanAccumulator::new();

    if metadata.is_file() {
        accumulator.size = metadata.len();
        accumulator.scanned_entries = 1;
        accumulator.maybe_emit(true, &mut emit_progress);
        return Ok(accumulator.into_result());
    }

    if should_skip_directory_traversal(target, &metadata) {
        accumulator.mark_partial();
        accumulator.maybe_emit(true, &mut emit_progress);
        return Ok(accumulator.into_result());
    }

    if !metadata.is_dir() {
        accumulator.maybe_emit(true, &mut emit_progress);
        return Ok(accumulator.into_result());
    }

    scan_dir_size_recursive(
        target,
        metadata_device(&metadata),
        cancel_flag,
        &mut accumulator,
        &mut emit_progress,
    )?;
    accumulator.maybe_emit(true, &mut emit_progress);
    Ok(accumulator.into_result())
}

fn scan_dir_size_recursive<F>(
    path: &Path,
    root_device: Option<u64>,
    cancel_flag: &AtomicBool,
    accumulator: &mut ScanAccumulator,
    emit_progress: &mut F,
) -> Result<(), String>
where
    F: FnMut(ScanProgress),
{
    if cancel_flag.load(Ordering::SeqCst) {
        return Err("Directory size scan cancelled".to_string());
    }

    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => {
            accumulator.mark_partial();
            accumulator.maybe_emit(false, emit_progress);
            return Ok(());
        }
    };

    for entry in entries {
        if cancel_flag.load(Ordering::SeqCst) {
            return Err("Directory size scan cancelled".to_string());
        }

        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                accumulator.mark_partial();
                accumulator.maybe_emit(false, emit_progress);
                continue;
            }
        };

        accumulator.scanned_entries = accumulator.scanned_entries.saturating_add(1);
        accumulator.entries_since_emit = accumulator.entries_since_emit.saturating_add(1);

        let metadata = match fs::symlink_metadata(entry.path()) {
            Ok(metadata) => metadata,
            Err(_) => {
                accumulator.mark_partial();
                accumulator.maybe_emit(false, emit_progress);
                continue;
            }
        };

        if metadata.is_file() {
            accumulator.size = accumulator.size.saturating_add(metadata.len());
        } else if should_skip_directory_traversal(&entry.path(), &metadata) {
            continue;
        } else if metadata.is_dir() {
            if !is_same_filesystem(root_device, &metadata) {
                accumulator.mark_partial();
                accumulator.maybe_emit(false, emit_progress);
                continue;
            }

            scan_dir_size_recursive(
                &entry.path(),
                root_device,
                cancel_flag,
                accumulator,
                emit_progress,
            )?;
        }

        accumulator.maybe_emit(false, emit_progress);
    }

    Ok(())
}
