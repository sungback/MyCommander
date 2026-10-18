use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{mpsc, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rayon::prelude::*;
use rayon::{ThreadPool, ThreadPoolBuilder};

use super::compute::should_skip_directory_traversal;
use super::types::DirectorySizeScanResult;

const SCAN_PROGRESS_INTERVAL: Duration = Duration::from_millis(200);
/// 깊은 트리에서 rayon 작업자가 훔친 작업을 자기 스택 위에서 이어 실행하므로 기본값보다 넉넉히 잡는다.
const SCAN_THREAD_STACK_SIZE: usize = 8 * 1024 * 1024;
const MIN_SCAN_THREADS: usize = 4;
const MAX_SCAN_THREADS: usize = 8;
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

/// macOS 데이터 볼륨이 firmlink로 다시 보이는 경로.
/// `/`와 장치 번호가 같아 `VolumeBoundary`로 걸러지지 않으므로, 하위로 내려가면
/// `/Users`·`/Applications` 등 데이터 볼륨 전체가 `/System` 합계에 더해지고 `/`에서는 두 번 집계된다.
#[cfg(target_os = "macos")]
const MACOS_DATA_VOLUME_MIRROR: &str = "/System/Volumes/Data";

/// 스캔 도중 만난 디렉터리가 데이터 볼륨의 firmlink 경로면 true. 스캔 루트 자체에는 적용하지 않는다.
#[cfg(target_os = "macos")]
pub(super) fn is_data_volume_mirror(path: &Path) -> bool {
    path == Path::new(MACOS_DATA_VOLUME_MIRROR)
}

#[cfg(not(target_os = "macos"))]
pub(super) fn is_data_volume_mirror(_path: &Path) -> bool {
    false
}

fn unix_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

/// 크기 계산 전용 스레드 수. 코어 수와 관계없이 4~8개로 제한한다(메타데이터 조회가 병목이라 너무 많으면 이득이 없다).
pub(super) fn default_scan_threads() -> usize {
    std::thread::available_parallelism()
        .map(|threads| threads.get())
        .unwrap_or(MIN_SCAN_THREADS)
        .clamp(MIN_SCAN_THREADS, MAX_SCAN_THREADS)
}

pub(super) fn build_scan_pool(threads: usize) -> Result<ThreadPool, String> {
    ThreadPoolBuilder::new()
        .num_threads(threads.max(1))
        .stack_size(SCAN_THREAD_STACK_SIZE)
        .thread_name(|index| format!("dir-size-{index}"))
        .build()
        .map_err(|e| e.to_string())
}

/// `sysinfo`가 쓰는 rayon 전역 풀과 분리한 로컬 경로 크기 계산 전용 풀.
fn shared_scan_pool() -> Option<&'static ThreadPool> {
    static POOL: OnceLock<Option<ThreadPool>> = OnceLock::new();
    POOL.get_or_init(|| build_scan_pool(default_scan_threads()).ok())
        .as_ref()
}

/// 스캔 루트가 네트워크 파일시스템이면 true. 내부 마운트는 `VolumeBoundary`가 막으므로 루트만 확인한다.
#[cfg(target_os = "macos")]
pub(super) fn is_network_filesystem(path: &Path) -> bool {
    filesystem_type_name(path).is_some_and(|name| is_network_filesystem_type(&name))
}

#[cfg(target_os = "windows")]
fn is_network_filesystem(path: &Path) -> bool {
    is_windows_unc_path(&path.to_string_lossy())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn is_network_filesystem(_path: &Path) -> bool {
    false
}

#[cfg(target_os = "macos")]
pub(super) fn filesystem_type_name(path: &Path) -> Option<String> {
    use std::ffi::{CStr, CString};
    use std::os::unix::ffi::OsStrExt;

    let c_path = CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut stats = std::mem::MaybeUninit::<libc::statfs>::uninit();
    // SAFETY: c_path는 NUL로 끝나는 유효한 C 문자열이고, stats는 statfs 구조체 크기만큼 쓸 수 있는 메모리다.
    let result = unsafe { libc::statfs(c_path.as_ptr(), stats.as_mut_ptr()) };
    if result != 0 {
        return None;
    }

    // SAFETY: statfs가 0을 돌려주면 구조체 전체를 채운다. f_fstypename은 NUL로 끝나는 고정 길이 배열이다.
    let name = unsafe {
        let stats = stats.assume_init();
        CStr::from_ptr(stats.f_fstypename.as_ptr())
            .to_string_lossy()
            .into_owned()
    };
    Some(name)
}

#[cfg(target_os = "macos")]
pub(super) fn is_network_filesystem_type(name: &str) -> bool {
    matches!(name, "smbfs" | "nfs" | "afpfs" | "webdav" | "cifs" | "ftp")
}

#[cfg(target_os = "windows")]
pub(super) fn is_windows_unc_path(path: &str) -> bool {
    // \\server\share 또는 \\?\UNC\server\share. \\?\C:\ 같은 로컬 확장 경로는 제외한다.
    (path.starts_with("\\\\") && !path.starts_with("\\\\?\\")) || path.starts_with("\\\\?\\UNC\\")
}

/// 항목 메타데이터를 링크를 따라가지 않고 읽는다.
/// Unix의 `DirEntry::metadata`는 디렉터리 기준 상대 조회(fstatat)라 전체 경로 조회보다 빠르다.
#[cfg(unix)]
fn entry_metadata(entry: &fs::DirEntry) -> std::io::Result<fs::Metadata> {
    entry.metadata()
}

/// Windows의 `DirEntry::metadata`는 목록 조회 때 받은 값이라 쓰는 중인 파일의 크기가 늦게 반영될 수 있어,
/// 1단계와 같이 파일마다 다시 조회한다.
#[cfg(not(unix))]
fn entry_metadata(entry: &fs::DirEntry) -> std::io::Result<fs::Metadata> {
    fs::symlink_metadata(entry.path())
}

struct Cancelled;

/// 하드링크 파일 하나: (dev, ino, 집계할 크기). 스캔이 끝난 뒤 (dev, ino)로 한 번만 더한다.
type HardLinkRecord = (u64, u64, u64);

#[cfg(unix)]
fn hard_link_record(metadata: &fs::Metadata) -> Option<HardLinkRecord> {
    use std::os::unix::fs::MetadataExt;

    (metadata.nlink() > 1).then(|| (metadata.dev(), metadata.ino(), counted_file_size(metadata)))
}

#[cfg(not(unix))]
fn hard_link_record(_metadata: &fs::Metadata) -> Option<HardLinkRecord> {
    None
}

/// 여러 작업자가 함께 쓰는 스캔 상태. 진행 표시용 값은 원자 변수로 모은다.
/// `size`에는 하드링크 파일을 넣지 않는다(중복 제거 전이라 진행값이 최종값을 넘지 않게 한다).
struct ParallelScan<'a> {
    cancel_flag: &'a AtomicBool,
    volume: VolumeBoundary,
    size: AtomicU64,
    scanned_entries: AtomicUsize,
    error_count: AtomicUsize,
    inaccessible_count: AtomicUsize,
    is_partial: AtomicBool,
}

impl<'a> ParallelScan<'a> {
    fn new(cancel_flag: &'a AtomicBool, root_metadata: &fs::Metadata) -> Self {
        Self {
            cancel_flag,
            volume: VolumeBoundary::new(root_metadata),
            size: AtomicU64::new(0),
            scanned_entries: AtomicUsize::new(0),
            error_count: AtomicUsize::new(0),
            inaccessible_count: AtomicUsize::new(0),
            is_partial: AtomicBool::new(false),
        }
    }

    fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::Relaxed)
    }

    /// 권한 부족은 다시 계산해도 같으므로 partial이 아니라 접근 불가 개수로 센다.
    /// (partial은 재스캔 대상이라 Windows `C:\Users` 등에서 "+" 표시가 풀리지 않는 문제가 있었다.)
    fn record_error(&self, error: &std::io::Error) {
        if error.kind() == std::io::ErrorKind::PermissionDenied {
            self.inaccessible_count.fetch_add(1, Ordering::Relaxed);
        } else {
            self.is_partial.store(true, Ordering::Relaxed);
            self.error_count.fetch_add(1, Ordering::Relaxed);
        }
    }

    fn progress(&self, completed: bool) -> ScanProgress {
        ScanProgress {
            size: self.size.load(Ordering::Relaxed),
            is_partial: self.is_partial.load(Ordering::Relaxed),
            scanned_entries: self.scanned_entries.load(Ordering::Relaxed),
            completed,
        }
    }

    /// 디렉터리 하나를 읽고 하위 디렉터리는 병렬로 처리한다. 하드링크 파일 목록을 돌려준다.
    fn scan_dir(&self, path: &Path) -> Result<Vec<HardLinkRecord>, Cancelled> {
        if self.is_cancelled() {
            return Err(Cancelled);
        }

        let mut hard_links = Vec::new();
        let subdirs = self.read_entries(path, &mut hard_links)?;
        let nested = subdirs
            .into_par_iter()
            .map(|subdir| self.scan_dir(&subdir))
            .try_reduce(Vec::new, |mut left, mut right| {
                if left.len() < right.len() {
                    std::mem::swap(&mut left, &mut right);
                }
                left.append(&mut right);
                Ok(left)
            })?;

        hard_links.extend(nested);
        Ok(hard_links)
    }

    /// 디렉터리 항목을 모두 처리하고 내려갈 하위 디렉터리 목록을 돌려준다.
    /// 디렉터리 핸들은 이 함수가 끝나면 닫힌다. 하위로 내려가는 동안 열어 두면
    /// 병렬 작업에서 열린 파일 수가 깊이 × 분기 수만큼 늘어 한도(EMFILE)에 걸릴 수 있다.
    fn read_entries(
        &self,
        path: &Path,
        hard_links: &mut Vec<HardLinkRecord>,
    ) -> Result<Vec<PathBuf>, Cancelled> {
        let entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(e) => {
                self.record_error(&e);
                return Ok(Vec::new());
            }
        };

        let mut subdirs = Vec::new();
        for entry in entries {
            if self.is_cancelled() {
                return Err(Cancelled);
            }

            let entry = match entry {
                Ok(entry) => entry,
                Err(e) => {
                    self.record_error(&e);
                    continue;
                }
            };
            self.scanned_entries.fetch_add(1, Ordering::Relaxed);

            let metadata = match entry_metadata(&entry) {
                Ok(metadata) => metadata,
                Err(e) => {
                    self.record_error(&e);
                    continue;
                }
            };

            if metadata.is_file() {
                match hard_link_record(&metadata) {
                    Some(record) => hard_links.push(record),
                    None => {
                        self.size
                            .fetch_add(counted_file_size(&metadata), Ordering::Relaxed);
                    }
                }
                continue;
            }

            if should_skip_directory_traversal(&metadata) || !self.volume.contains(&metadata) {
                continue;
            }

            if metadata.is_dir() {
                let child = entry.path();
                if !is_data_volume_mirror(&child) {
                    subdirs.push(child);
                }
            }
        }

        Ok(subdirs)
    }
}

pub(crate) fn scan_path_size_with_progress<F>(
    path: &str,
    cancel_flag: &AtomicBool,
    emit_progress: F,
) -> Result<DirectorySizeScanResult, String>
where
    F: FnMut(ScanProgress),
{
    if is_network_filesystem(Path::new(path)) {
        // 네트워크 파일시스템은 동시 요청이 오히려 느리므로 스레드 하나로 돈다.
        // 스캔마다 풀을 따로 만들어, 한 공유 폴더가 멈춰도 다른 스캔이 기다리지 않게 한다.
        let pool = build_scan_pool(1).ok();
        return scan_path_size_with_pool(path, cancel_flag, emit_progress, pool.as_ref());
    }

    scan_path_size_with_pool(path, cancel_flag, emit_progress, shared_scan_pool())
}

/// `pool`에서 스캔한다. `None`이면 rayon 전역 풀을 쓴다(전용 풀 생성에 실패한 경우).
pub(super) fn scan_path_size_with_pool<F>(
    path: &str,
    cancel_flag: &AtomicBool,
    mut emit_progress: F,
    pool: Option<&ThreadPool>,
) -> Result<DirectorySizeScanResult, String>
where
    F: FnMut(ScanProgress),
{
    let started_at_ms = unix_time_ms();
    let target = Path::new(path);
    let metadata = fs::symlink_metadata(target).map_err(|e| e.to_string())?;
    let mut result = DirectorySizeScanResult {
        size: 0,
        is_partial: false,
        scanned_entries: 0,
        error_count: 0,
        inaccessible_count: 0,
        started_at_ms,
    };

    if metadata.is_file() {
        result.size = counted_file_size(&metadata);
        result.scanned_entries = 1;
    } else if should_skip_directory_traversal(&metadata) {
        result.is_partial = true;
        result.error_count = 1;
    } else if metadata.is_dir() {
        let scan = ParallelScan::new(cancel_flag, &metadata);
        let hard_links = run_with_progress(&scan, target, pool, &mut emit_progress)?;
        result.size = scan
            .size
            .load(Ordering::Relaxed)
            .saturating_add(unique_hard_link_size(hard_links));
        result.is_partial = scan.is_partial.load(Ordering::Relaxed);
        result.scanned_entries = scan.scanned_entries.load(Ordering::Relaxed);
        result.error_count = scan.error_count.load(Ordering::Relaxed);
        result.inaccessible_count = scan.inaccessible_count.load(Ordering::Relaxed);
    }

    emit_progress(ScanProgress {
        size: result.size,
        is_partial: result.is_partial,
        scanned_entries: result.scanned_entries,
        completed: true,
    });
    Ok(result)
}

/// 작업자 풀에서 스캔하는 동안 호출 스레드는 진행 이벤트만 보낸다.
/// `emit_progress`는 Send가 아닐 수 있어 작업자 스레드에서 부르지 않는다.
fn run_with_progress<F>(
    scan: &ParallelScan<'_>,
    root: &Path,
    pool: Option<&ThreadPool>,
    emit_progress: &mut F,
) -> Result<Vec<HardLinkRecord>, String>
where
    F: FnMut(ScanProgress),
{
    std::thread::scope(|scope| {
        let (result_tx, result_rx) = mpsc::channel();
        scope.spawn(move || {
            let outcome = match pool {
                Some(pool) => pool.install(|| scan.scan_dir(root)),
                None => scan.scan_dir(root),
            };
            let _ = result_tx.send(outcome);
        });

        loop {
            match result_rx.recv_timeout(SCAN_PROGRESS_INTERVAL) {
                Ok(Ok(hard_links)) => return Ok(hard_links),
                Ok(Err(Cancelled)) => return Err(SCAN_CANCELLED_MESSAGE.to_string()),
                Err(mpsc::RecvTimeoutError::Timeout) => emit_progress(scan.progress(false)),
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    return Err("Directory size scan worker stopped unexpectedly".to_string())
                }
            }
        }
    })
}

fn unique_hard_link_size(records: Vec<HardLinkRecord>) -> u64 {
    let mut seen = HashSet::with_capacity(records.len());
    records
        .into_iter()
        .filter(|(dev, ino, _)| seen.insert((*dev, *ino)))
        .fold(0_u64, |total, (_, _, size)| total.saturating_add(size))
}
