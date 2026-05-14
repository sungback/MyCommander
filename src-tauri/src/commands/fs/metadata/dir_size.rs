use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

const DEFAULT_ESTIMATE_MAX_DEPTH: usize = 1;
const DEFAULT_ESTIMATE_MAX_ENTRIES: usize = 200;
const MAX_ESTIMATE_DEPTH: usize = 4;
const MAX_ESTIMATE_ENTRIES: usize = 5_000;
const SCAN_PROGRESS_INTERVAL: Duration = Duration::from_millis(200);
const SCAN_PROGRESS_ENTRY_INTERVAL: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeEstimate {
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeScanResult {
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
    pub error_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeProgress {
    pub scan_id: String,
    pub path: String,
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
    pub completed: bool,
}

#[derive(Clone, Default)]
pub struct DirSizeScanState {
    active_scans: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl DirSizeScanState {
    fn begin(&self, scan_id: &str) -> Result<Arc<AtomicBool>, String> {
        let mut active_scans = self
            .active_scans
            .lock()
            .map_err(|_| "Directory size scan state is unavailable".to_string())?;

        if active_scans.contains_key(scan_id) {
            return Err(format!("Directory size scan `{scan_id}` is already active"));
        }

        let cancel_flag = Arc::new(AtomicBool::new(false));
        active_scans.insert(scan_id.to_string(), cancel_flag.clone());
        Ok(cancel_flag)
    }

    fn end(&self, scan_id: &str) {
        if let Ok(mut active_scans) = self.active_scans.lock() {
            active_scans.remove(scan_id);
        }
    }

    pub fn cancel(&self, scan_id: &str) -> bool {
        self.active_scans
            .lock()
            .ok()
            .and_then(|active_scans| active_scans.get(scan_id).cloned())
            .is_some_and(|cancel_flag| {
                cancel_flag.store(true, Ordering::SeqCst);
                true
            })
    }
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

pub async fn scan_dir_size(
    app: AppHandle,
    state: DirSizeScanState,
    path: String,
    scan_id: String,
) -> Result<DirectorySizeScanResult, String> {
    let cancel_flag = state.begin(&scan_id)?;
    let scan_result = tokio::task::spawn_blocking({
        let cancel_flag = cancel_flag.clone();
        let path = path.clone();
        let scan_id = scan_id.clone();
        move || {
            scan_path_size_with_progress(&path, &cancel_flag, |progress| {
                let _ = app.emit(
                    "dir-size-progress",
                    DirectorySizeProgress {
                        scan_id: scan_id.clone(),
                        path: path.clone(),
                        size: progress.size,
                        is_partial: progress.is_partial,
                        scanned_entries: progress.scanned_entries,
                        completed: progress.completed,
                    },
                );
            })
        }
    })
    .await;

    state.end(&scan_id);
    scan_result.map_err(|e| e.to_string())?
}

pub fn cancel_dir_size_scan(state: DirSizeScanState, scan_id: String) -> Result<(), String> {
    state.cancel(&scan_id);
    Ok(())
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

fn should_skip_directory_traversal(metadata: &fs::Metadata) -> bool {
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

#[derive(Debug, Clone, Copy)]
struct ScanProgress {
    size: u64,
    is_partial: bool,
    scanned_entries: usize,
    completed: bool,
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
}

fn scan_path_size_with_progress<F>(
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

    if should_skip_directory_traversal(&metadata) {
        accumulator.mark_partial();
        accumulator.maybe_emit(true, &mut emit_progress);
        return Ok(accumulator.into_result());
    }

    if !metadata.is_dir() {
        accumulator.maybe_emit(true, &mut emit_progress);
        return Ok(accumulator.into_result());
    }

    scan_dir_size_recursive(target, cancel_flag, &mut accumulator, &mut emit_progress)?;
    accumulator.maybe_emit(true, &mut emit_progress);
    Ok(accumulator.into_result())
}

impl ScanAccumulator {
    fn into_result(self) -> DirectorySizeScanResult {
        DirectorySizeScanResult {
            size: self.size,
            is_partial: self.is_partial,
            scanned_entries: self.scanned_entries,
            error_count: self.error_count,
        }
    }
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
    let cancel_flag = AtomicBool::new(false);
    scan_path_size_with_progress(path, &cancel_flag, |_| {}).map(|result| result.size)
}

fn scan_dir_size_recursive<F>(
    path: &Path,
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
        } else if should_skip_directory_traversal(&metadata) {
            continue;
        } else if metadata.is_dir() {
            scan_dir_size_recursive(&entry.path(), cancel_flag, accumulator, emit_progress)?;
        }

        accumulator.maybe_emit(false, emit_progress);
    }

    Ok(())
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

#[cfg(test)]
mod tests {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    use super::parse_du_size_bytes;
    use super::{estimate_path_size, scan_path_size_with_progress};
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::symlink;
    use std::sync::atomic::AtomicBool;
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

    #[test]
    fn scan_path_size_with_progress_reports_nested_exact_size() {
        let root = make_temp_dir("scan-exact");
        let child = root.join("child");
        fs::create_dir_all(&child).unwrap();
        fs::write(root.join("root.bin"), [1_u8; 10]).unwrap();
        fs::write(child.join("child.bin"), [1_u8; 20]).unwrap();
        let cancel_flag = AtomicBool::new(false);
        let mut progress_events = Vec::new();

        let result =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |progress| {
                progress_events.push(progress);
            })
            .unwrap();

        assert_eq!(result.size, 30);
        assert!(!result.is_partial);
        assert_eq!(result.error_count, 0);
        assert!(progress_events.last().is_some_and(|event| event.completed));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_path_size_with_progress_can_be_cancelled() {
        let root = make_temp_dir("scan-cancel");
        fs::write(root.join("file.bin"), [1_u8; 10]).unwrap();
        let cancel_flag = AtomicBool::new(true);

        let result = scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {});

        assert_eq!(result.unwrap_err(), "Directory size scan cancelled");

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn scan_path_size_skips_symlinked_directories_without_marking_partial() {
        let root = make_temp_dir("scan-symlink-dir");
        let outside = make_temp_dir("scan-symlink-outside");
        fs::write(outside.join("outside.bin"), [1_u8; 99]).unwrap();
        fs::write(root.join("inside.bin"), [1_u8; 10]).unwrap();
        symlink(&outside, root.join("linked-outside")).unwrap();
        let cancel_flag = AtomicBool::new(false);

        let result =
            scan_path_size_with_progress(root.to_str().unwrap(), &cancel_flag, |_| {}).unwrap();

        assert_eq!(result.size, 10);
        assert!(!result.is_partial);
        assert_eq!(result.error_count, 0);

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn estimate_path_size_marks_symlinked_directories_partial_without_following() {
        let root = make_temp_dir("estimate-symlink-dir");
        let outside = make_temp_dir("estimate-symlink-outside");
        fs::write(outside.join("outside.bin"), [1_u8; 99]).unwrap();
        fs::write(root.join("inside.bin"), [1_u8; 10]).unwrap();
        symlink(&outside, root.join("linked-outside")).unwrap();

        let estimate = estimate_path_size(root.to_str().unwrap(), 4, 100).unwrap();

        assert_eq!(estimate.size, 10);
        assert!(estimate.is_partial);

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
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
