#[cfg(unix)]
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use super::compute::should_skip_directory_traversal;
use super::types::DirectorySizeScanResult;

const SCAN_PROGRESS_INTERVAL: Duration = Duration::from_millis(200);
const SCAN_PROGRESS_ENTRY_INTERVAL: usize = 256;
/// 취소된 스캔의 오류 메시지. 프런트엔드는 "cancel" 포함 여부로 취소를 판별한다.
pub(super) const SCAN_CANCELLED_MESSAGE: &str = "Directory size scan cancelled";

#[derive(Debug, Clone, Copy)]
pub(super) struct ScanProgress {
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
    pub completed: bool,
}

/// 이 크기 이상이면서 실제 할당이 절반 미만인 파일만 sparse 파일로 본다.
/// 작은 파일이나 일반 파일의 블록 반올림 차이로 기준이 흔들리지 않게 한다.
#[cfg(unix)]
const SPARSE_FILE_MIN_LEN: u64 = 1024 * 1024 * 1024;

/// 디렉터리 합계에 더할 파일 크기.
/// 크기 기준은 모든 폴더(.app 포함)에서 겉보기 크기(apparent size, `st_size`) 하나로 통일한다.
/// 예외로 OrbStack/Docker 가상 디스크 같은 sparse 파일은 겉보기 크기(수 TB)가 아니라 실제 할당 크기를 쓴다.
#[cfg(unix)]
pub(super) fn counted_file_size(metadata: &fs::Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;

    let len = metadata.len();
    if len < SPARSE_FILE_MIN_LEN {
        return len;
    }

    let allocated = metadata.blocks().saturating_mul(512);
    if allocated < len / 2 {
        allocated
    } else {
        len
    }
}

#[cfg(not(unix))]
pub(super) fn counted_file_size(metadata: &fs::Metadata) -> u64 {
    metadata.len()
}

/// 같은 inode를 가리키는 하드링크를 한 번만 집계하기 위한 추적기.
/// conda/pnpm처럼 하드링크를 많이 쓰는 폴더가 실제보다 크게 보이는 것을 막는다.
#[derive(Default)]
pub(super) struct HardLinkTracker {
    #[cfg(unix)]
    seen: HashSet<(u64, u64)>,
}

impl HardLinkTracker {
    /// 파일 크기를 집계해야 하면 true. 이미 집계한 하드링크면 false.
    #[cfg(unix)]
    pub(super) fn should_count(&mut self, metadata: &fs::Metadata) -> bool {
        use std::os::unix::fs::MetadataExt;

        if metadata.nlink() <= 1 {
            return true;
        }

        self.seen.insert((metadata.dev(), metadata.ino()))
    }

    #[cfg(not(unix))]
    pub(super) fn should_count(&mut self, _metadata: &fs::Metadata) -> bool {
        true
    }
}

/// 스캔을 시작한 루트와 같은 볼륨(파일시스템)인지 판별한다.
/// 외장 디스크, 디스크 이미지, `/dev` 같은 다른 볼륨의 마운트 지점으로는 내려가지 않는다(`du -x`와 같은 기준).
/// Windows는 볼륨 경계가 reparse point로 드러나고 이미 따라가지 않으므로 항상 같은 볼륨으로 본다.
pub(super) struct VolumeBoundary {
    #[cfg(unix)]
    root_dev: u64,
}

impl VolumeBoundary {
    #[cfg(unix)]
    pub(super) fn new(root_metadata: &fs::Metadata) -> Self {
        use std::os::unix::fs::MetadataExt;

        Self {
            root_dev: root_metadata.dev(),
        }
    }

    #[cfg(not(unix))]
    pub(super) fn new(_root_metadata: &fs::Metadata) -> Self {
        Self {}
    }

    #[cfg(unix)]
    pub(super) fn contains(&self, metadata: &fs::Metadata) -> bool {
        use std::os::unix::fs::MetadataExt;

        metadata.dev() == self.root_dev
    }

    #[cfg(not(unix))]
    pub(super) fn contains(&self, _metadata: &fs::Metadata) -> bool {
        true
    }
}

struct ScanAccumulator {
    hard_links: HardLinkTracker,
    volume: VolumeBoundary,
    size: u64,
    is_partial: bool,
    scanned_entries: usize,
    error_count: usize,
    inaccessible_count: usize,
    started_at_ms: u64,
    last_emit_at: Instant,
    entries_since_emit: usize,
}

impl ScanAccumulator {
    fn new(root_metadata: &fs::Metadata, started_at_ms: u64) -> Self {
        Self {
            hard_links: HardLinkTracker::default(),
            volume: VolumeBoundary::new(root_metadata),
            size: 0,
            is_partial: false,
            scanned_entries: 0,
            error_count: 0,
            inaccessible_count: 0,
            started_at_ms,
            last_emit_at: Instant::now(),
            entries_since_emit: 0,
        }
    }

    fn mark_partial(&mut self) {
        self.is_partial = true;
        self.error_count = self.error_count.saturating_add(1);
    }

    /// 읽기 오류를 기록한다.
    /// 권한 부족은 다시 계산해도 같은 결과가 나오므로 partial로 보지 않고 접근 불가 개수로만 센다.
    /// (partial은 재스캔 대상이라 Windows `C:\Users` 등에서 "+" 표시가 풀리지 않는 문제가 있었다.)
    fn record_error(&mut self, error: &std::io::Error) {
        if error.kind() == std::io::ErrorKind::PermissionDenied {
            self.inaccessible_count = self.inaccessible_count.saturating_add(1);
        } else {
            self.mark_partial();
        }
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
            inaccessible_count: self.inaccessible_count,
            started_at_ms: self.started_at_ms,
        }
    }
}

fn unix_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

pub(crate) fn scan_path_size_with_progress<F>(
    path: &str,
    cancel_flag: &AtomicBool,
    mut emit_progress: F,
) -> Result<DirectorySizeScanResult, String>
where
    F: FnMut(ScanProgress),
{
    let started_at_ms = unix_time_ms();
    let target = Path::new(path);
    let metadata = fs::symlink_metadata(target).map_err(|e| e.to_string())?;
    let mut accumulator = ScanAccumulator::new(&metadata, started_at_ms);

    if metadata.is_file() {
        accumulator.size = counted_file_size(&metadata);
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
        return Err(SCAN_CANCELLED_MESSAGE.to_string());
    }

    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) => {
            accumulator.record_error(&e);
            accumulator.maybe_emit(false, emit_progress);
            return Ok(());
        }
    };

    for entry in entries {
        if cancel_flag.load(Ordering::SeqCst) {
            return Err(SCAN_CANCELLED_MESSAGE.to_string());
        }

        let entry = match entry {
            Ok(entry) => entry,
            Err(e) => {
                accumulator.record_error(&e);
                accumulator.maybe_emit(false, emit_progress);
                continue;
            }
        };

        accumulator.scanned_entries = accumulator.scanned_entries.saturating_add(1);
        accumulator.entries_since_emit = accumulator.entries_since_emit.saturating_add(1);

        let metadata = match fs::symlink_metadata(entry.path()) {
            Ok(metadata) => metadata,
            Err(e) => {
                accumulator.record_error(&e);
                accumulator.maybe_emit(false, emit_progress);
                continue;
            }
        };

        if metadata.is_file() {
            if accumulator.hard_links.should_count(&metadata) {
                accumulator.size = accumulator
                    .size
                    .saturating_add(counted_file_size(&metadata));
            }
        } else if should_skip_directory_traversal(&metadata)
            || !accumulator.volume.contains(&metadata)
        {
            continue;
        } else if metadata.is_dir() {
            scan_dir_size_recursive(&entry.path(), cancel_flag, accumulator, emit_progress)?;
        }

        accumulator.maybe_emit(false, emit_progress);
    }

    Ok(())
}
