//! 폴더 크기 계산 측정용 ignored 테스트(개선 계획 0단계).
//! 일반 테스트(`npm run test:rust`)에서는 실행되지 않는다. 측정은 반드시 release 빌드로 한다.
//!
//! 고정 테스트 폴더 생성:
//! `MYCOMMANDER_SIZE_BENCH_FIXTURES=<dir> cargo test --release --lib dir_size::bench::generate -- --ignored --nocapture`
//!
//! 측정:
//! `MYCOMMANDER_SIZE_BENCH_PATHS=<path1>:<path2> cargo test --release --lib dir_size::bench::measure -- --ignored --nocapture`
//! - `MYCOMMANDER_SIZE_BENCH_METHOD`: `scanner` | `du` | `threads` | `all`(기본값). cold에서 `du`는 `du -skx`만 잰다.
//!   `threads`는 스레드 수별 병렬 스캐너(`scanner-tN`)를 비교한다.
//! - `MYCOMMANDER_SIZE_BENCH_THREADS`: `threads`에서 잴 스레드 수 목록(기본값 `1,2,4,8`)
//! - `MYCOMMANDER_SIZE_BENCH_MODE`: `warm`(기본값, 예열 1회 후 3회 교차 실행의 중앙값) | `cold`(1회, 실행 전 `sudo purge`)

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::time::{Duration, Instant};

use super::scan::{build_scan_pool, scan_path_size_with_pool, scan_path_size_with_progress};

const PATHS_ENV: &str = "MYCOMMANDER_SIZE_BENCH_PATHS";
const METHOD_ENV: &str = "MYCOMMANDER_SIZE_BENCH_METHOD";
const MODE_ENV: &str = "MYCOMMANDER_SIZE_BENCH_MODE";
const FIXTURES_ENV: &str = "MYCOMMANDER_SIZE_BENCH_FIXTURES";
const THREADS_ENV: &str = "MYCOMMANDER_SIZE_BENCH_THREADS";
const WARM_REPEAT: usize = 3;
const FIXTURE_MARKER: &str = ".mycommander-size-bench-v1";

#[derive(Clone, Copy, PartialEq, Eq)]
enum Method {
    /// 앱과 같은 경로(기본 전용 풀).
    Scanner,
    /// 스레드 수를 지정한 병렬 스캐너. 측정마다 새 풀을 만든다.
    ScannerThreads(usize),
    /// 할당 크기. 1단계 이전 `.app` 계산 방식과 같다.
    DuAllocated,
    /// 겉보기 크기. 스캐너와 기준이 같지만 디렉터리 자체 크기도 더하고 sparse 보정이 없다.
    DuApparent,
}

impl Method {
    fn label(self) -> String {
        match self {
            Method::Scanner => "scanner".to_string(),
            Method::ScannerThreads(threads) => format!("scanner-t{threads}"),
            Method::DuAllocated => "du -skx".to_string(),
            Method::DuApparent => "du -sAkx".to_string(),
        }
    }
}

struct Sample {
    elapsed: Duration,
    size: u64,
    /// 스캐너: 읽은 항목 수 / du: 없음
    entries: Option<usize>,
    /// 스캐너: 접근 불가 항목 수 / du: stderr 줄 수(권한 오류 등)
    problems: usize,
    is_partial: bool,
}

fn selected_methods() -> Vec<Method> {
    match env::var(METHOD_ENV).as_deref() {
        Ok("scanner") => vec![Method::Scanner],
        // cold에서 du를 두 번 돌리면 두 번째는 캐시가 데워진 상태라 할당 크기 1회만 잰다.
        Ok("du") if is_cold_mode() => vec![Method::DuAllocated],
        Ok("du") => vec![Method::DuAllocated, Method::DuApparent],
        Ok("threads") => selected_thread_counts()
            .into_iter()
            .map(Method::ScannerThreads)
            .collect(),
        _ => vec![Method::Scanner, Method::DuAllocated, Method::DuApparent],
    }
}

fn selected_thread_counts() -> Vec<usize> {
    env::var(THREADS_ENV)
        .ok()
        .map(|value| {
            value
                .split(',')
                .filter_map(|count| count.trim().parse::<usize>().ok())
                .filter(|count| *count > 0)
                .collect::<Vec<_>>()
        })
        .filter(|counts| !counts.is_empty())
        .unwrap_or_else(|| vec![1, 2, 4, 8])
}

fn is_cold_mode() -> bool {
    env::var(MODE_ENV).as_deref() == Ok("cold")
}

fn run_method(method: Method, path: &Path) -> Result<Sample, String> {
    match method {
        Method::Scanner => run_scanner(path, ScannerKind::Default),
        Method::ScannerThreads(threads) => run_scanner(path, ScannerKind::Threads(threads)),
        Method::DuAllocated => run_du(path, "-skx"),
        Method::DuApparent => run_du(path, "-sAkx"),
    }
}

enum ScannerKind {
    Default,
    Threads(usize),
}

fn run_scanner(path: &Path, kind: ScannerKind) -> Result<Sample, String> {
    let path = path.to_str().ok_or("path is not valid UTF-8")?;
    let cancel_flag = AtomicBool::new(false);
    // 풀 생성 시간은 측정에 넣지 않는다.
    let pool = match kind {
        ScannerKind::Threads(threads) => Some(build_scan_pool(threads)?),
        _ => None,
    };
    let started = Instant::now();
    let result = match kind {
        ScannerKind::Default => scan_path_size_with_progress(path, &cancel_flag, |_| {})?,
        ScannerKind::Threads(_) => {
            scan_path_size_with_pool(path, &cancel_flag, |_| {}, pool.as_ref())?
        }
    };

    Ok(Sample {
        elapsed: started.elapsed(),
        size: result.size,
        entries: Some(result.scanned_entries),
        problems: result.inaccessible_count,
        is_partial: result.is_partial,
    })
}

#[cfg(target_os = "macos")]
fn run_du(path: &Path, flags: &str) -> Result<Sample, String> {
    use std::process::Command;

    let started = Instant::now();
    let output = Command::new("du")
        .arg(flags)
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;
    let elapsed = started.elapsed();
    let stdout = String::from_utf8_lossy(&output.stdout);
    let size_kb = stdout
        .split_whitespace()
        .next()
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or_else(|| format!("failed to parse du output: {stdout}"))?;

    Ok(Sample {
        elapsed,
        size: size_kb.saturating_mul(1024),
        entries: None,
        problems: String::from_utf8_lossy(&output.stderr).lines().count(),
        is_partial: false,
    })
}

#[cfg(not(target_os = "macos"))]
fn run_du(_path: &Path, _flags: &str) -> Result<Sample, String> {
    Err("du comparison is only wired up for macOS".to_string())
}

/// warm: 예열 1회는 버리고, 방법을 번갈아 3회 실행해 시간 중앙값을 쓴다(먼저 실행한 쪽이 캐시를 데우는 편향을 줄인다).
/// cold: 각 방법을 1회만 실행한다. 실행 전 `sudo purge`는 호출하는 쪽이 맡는다.
fn measure_path(path: &Path, methods: &[Method]) -> Vec<(Method, Result<Sample, String>)> {
    let repeat = if is_cold_mode() { 1 } else { WARM_REPEAT };
    if !is_cold_mode() {
        for &method in methods {
            let _ = run_method(method, path);
        }
    }

    let mut samples: Vec<Vec<Sample>> = methods.iter().map(|_| Vec::new()).collect();
    let mut errors: Vec<Option<String>> = methods.iter().map(|_| None).collect();
    for _ in 0..repeat {
        for (index, &method) in methods.iter().enumerate() {
            match run_method(method, path) {
                Ok(sample) => samples[index].push(sample),
                Err(error) => errors[index] = Some(error),
            }
        }
    }

    methods
        .iter()
        .zip(samples)
        .zip(errors)
        .map(|((&method, mut runs), error)| {
            if let Some(error) = error {
                return (method, Err(error));
            }
            runs.sort_by_key(|sample| sample.elapsed);
            let median = runs.swap_remove(runs.len() / 2);
            (method, Ok(median))
        })
        .collect()
}

fn format_bytes(size: u64) -> String {
    let digits = size.to_string();
    let mut grouped = String::new();
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            grouped.push(',');
        }
        grouped.push(digit);
    }
    grouped
}

#[test]
#[ignore = "manual measurement; see module docs"]
fn measure() {
    let Some(paths) = env::var_os(PATHS_ENV) else {
        println!("skip: set {PATHS_ENV} to measure directory size scans");
        return;
    };
    let methods = selected_methods();

    println!(
        "mode: {}, build: {}",
        if is_cold_mode() { "cold" } else { "warm" },
        if cfg!(debug_assertions) {
            "debug (측정값으로 쓰지 말 것)"
        } else {
            "release"
        }
    );
    println!("| 경로 | 방법 | 시간 | 크기(bytes) | 항목 수 | 접근 불가 / du 오류 줄 | partial |");
    println!("|---|---|---:|---:|---:|---:|---|");
    for path in env::split_paths(&paths) {
        for (method, result) in measure_path(&path, &methods) {
            match result {
                Ok(sample) => println!(
                    "| `{}` | {} | {:.2}s | {} | {} | {} | {} |",
                    path.display(),
                    method.label(),
                    sample.elapsed.as_secs_f64(),
                    format_bytes(sample.size),
                    sample
                        .entries
                        .map_or_else(|| "-".to_string(), |entries| format_bytes(entries as u64)),
                    sample.problems,
                    if sample.is_partial { "yes" } else { "no" },
                ),
                Err(error) => println!(
                    "| `{}` | {} | error: {error} | | | | |",
                    path.display(),
                    method.label()
                ),
            }
        }
    }
}

/// 내용이 항상 같은 고정 테스트 폴더를 만든다. 이미 만든 폴더는 다시 만들지 않는다.
#[test]
#[ignore = "manual fixture generation; see module docs"]
fn generate() {
    let Some(root) = env::var_os(FIXTURES_ENV).map(PathBuf::from) else {
        println!("skip: set {FIXTURES_ENV} to generate size bench fixtures");
        return;
    };

    if root.join(FIXTURE_MARKER).exists() {
        println!("fixtures already exist: {}", root.display());
        return;
    }
    // 다른 내용이 들어 있는 폴더를 덮어쓰지 않는다.
    if fs::read_dir(&root).is_ok_and(|mut entries| entries.next().is_some()) {
        panic!("{} is not empty and has no fixture marker", root.display());
    }

    write_small_files(&root.join("small-files")).unwrap();
    write_hard_links(&root.join("hard-links")).unwrap();
    write_sparse_file(&root.join("sparse-4g"), 4 * 1024 * 1024 * 1024).unwrap();
    write_sparse_file(&root.join("sparse-512m"), 512 * 1024 * 1024).unwrap();
    fs::write(root.join(FIXTURE_MARKER), b"v1\n").unwrap();
    println!("fixtures created: {}", root.display());
}

/// 작은 파일이 많은 폴더: 100개 폴더 × 200개 파일, 파일 크기 1~4096 bytes.
fn write_small_files(dir: &Path) -> std::io::Result<()> {
    for folder in 0..100_usize {
        let folder_path = dir.join(format!("dir-{folder:03}"));
        fs::create_dir_all(&folder_path)?;
        for file in 0..200_usize {
            let size = (folder * 200 + file) * 37 % 4096 + 1;
            fs::write(
                folder_path.join(format!("file-{file:03}.bin")),
                vec![7_u8; size],
            )?;
        }
    }
    Ok(())
}

/// 하드링크가 많은 폴더: 8 MiB 파일 하나를 10개 폴더에 50개씩 하드링크한다.
fn write_hard_links(dir: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    let original = dir.join("original.bin");
    fs::write(&original, vec![1_u8; 8 * 1024 * 1024])?;
    for folder in 0..10_usize {
        let folder_path = dir.join(format!("links-{folder:02}"));
        fs::create_dir_all(&folder_path)?;
        for link in 0..50_usize {
            fs::hard_link(&original, folder_path.join(format!("link-{link:02}.bin")))?;
        }
    }
    Ok(())
}

/// 데이터 없이 논리 크기만 늘린 sparse 파일 하나를 담은 폴더.
fn write_sparse_file(dir: &Path, len: u64) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    fs::File::create(dir.join("disk.img"))?.set_len(len)
}
