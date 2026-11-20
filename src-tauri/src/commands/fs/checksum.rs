use md5::Md5;
use regex::Regex;
use serde::Serialize;
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

const READ_BUFFER_BYTES: usize = 1024 * 1024;
// 체크섬 파일은 작은 텍스트이므로 이 크기를 넘으면 읽지 않는다.
const MAX_CHECKSUM_FILE_BYTES: u64 = 8 * 1024 * 1024;
pub(crate) const CHECKSUM_CANCELLED: &str = "cancelled";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ChecksumAlgorithm {
    Crc32,
    Md5,
    Sha1,
    Sha256,
}

impl ChecksumAlgorithm {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "crc32" => Ok(Self::Crc32),
            "md5" => Ok(Self::Md5),
            "sha1" => Ok(Self::Sha1),
            "sha256" => Ok(Self::Sha256),
            other => Err(format!("Unsupported checksum algorithm: {other}")),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Crc32 => "crc32",
            Self::Md5 => "md5",
            Self::Sha1 => "sha1",
            Self::Sha256 => "sha256",
        }
    }

    fn from_hex_len(len: usize) -> Option<Self> {
        match len {
            8 => Some(Self::Crc32),
            32 => Some(Self::Md5),
            40 => Some(Self::Sha1),
            64 => Some(Self::Sha256),
            _ => None,
        }
    }

    fn from_bsd_label(label: &str) -> Option<Self> {
        match label.to_ascii_uppercase().replace('-', "").as_str() {
            "CRC32" => Some(Self::Crc32),
            "MD5" => Some(Self::Md5),
            "SHA1" => Some(Self::Sha1),
            "SHA256" => Some(Self::Sha256),
            _ => None,
        }
    }
}

enum Hasher {
    Crc32(crc32fast::Hasher),
    Md5(Md5),
    Sha1(Sha1),
    Sha256(Sha256),
}

impl Hasher {
    fn new(algorithm: ChecksumAlgorithm) -> Self {
        match algorithm {
            ChecksumAlgorithm::Crc32 => Self::Crc32(crc32fast::Hasher::new()),
            ChecksumAlgorithm::Md5 => Self::Md5(Md5::new()),
            ChecksumAlgorithm::Sha1 => Self::Sha1(Sha1::new()),
            ChecksumAlgorithm::Sha256 => Self::Sha256(Sha256::new()),
        }
    }

    fn update(&mut self, bytes: &[u8]) {
        match self {
            Self::Crc32(hasher) => hasher.update(bytes),
            Self::Md5(hasher) => hasher.update(bytes),
            Self::Sha1(hasher) => hasher.update(bytes),
            Self::Sha256(hasher) => hasher.update(bytes),
        }
    }

    fn finalize_hex(self) -> String {
        match self {
            Self::Crc32(hasher) => format!("{:08x}", hasher.finalize()),
            Self::Md5(hasher) => to_hex(&hasher.finalize()),
            Self::Sha1(hasher) => to_hex(&hasher.finalize()),
            Self::Sha256(hasher) => to_hex(&hasher.finalize()),
        }
    }
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

// 취소 요청을 job_id별 플래그로 관리한다.
fn cancel_registry() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static REGISTRY: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

struct CancelGuard {
    job_id: String,
    flag: Arc<AtomicBool>,
}

impl CancelGuard {
    fn register(job_id: &str) -> Result<Self, String> {
        let mut registry = cancel_registry()
            .lock()
            .map_err(|_| "Checksum state is unavailable.".to_string())?;
        if registry.contains_key(job_id) {
            return Err(format!("Checksum job already running: {job_id}"));
        }
        let flag = Arc::new(AtomicBool::new(false));
        registry.insert(job_id.to_string(), flag.clone());
        Ok(Self {
            job_id: job_id.to_string(),
            flag,
        })
    }
}

impl Drop for CancelGuard {
    fn drop(&mut self) {
        if let Ok(mut registry) = cancel_registry().lock() {
            registry.remove(&self.job_id);
        }
    }
}

fn hash_file(
    path: &Path,
    algorithms: &[ChecksumAlgorithm],
    cancel: &AtomicBool,
) -> Result<Vec<(ChecksumAlgorithm, String)>, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut hashers: Vec<(ChecksumAlgorithm, Hasher)> = algorithms
        .iter()
        .map(|algorithm| (*algorithm, Hasher::new(*algorithm)))
        .collect();
    let mut buffer = vec![0u8; READ_BUFFER_BYTES];

    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err(CHECKSUM_CANCELLED.to_string());
        }
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        for (_, hasher) in hashers.iter_mut() {
            hasher.update(&buffer[..read]);
        }
    }

    Ok(hashers
        .into_iter()
        .map(|(algorithm, hasher)| (algorithm, hasher.finalize_hex()))
        .collect())
}

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct ChecksumValue {
    pub algorithm: String,
    pub value: String,
}

#[derive(Serialize, Debug)]
pub struct ChecksumFileResult {
    pub path: String,
    pub name: String,
    pub hashes: Vec<ChecksumValue>,
    pub error: Option<String>,
}

fn file_name_of(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn compute_checksums_blocking(
    paths: Vec<String>,
    algorithms: Vec<ChecksumAlgorithm>,
    cancel: &AtomicBool,
) -> Result<Vec<ChecksumFileResult>, String> {
    let mut results = Vec::with_capacity(paths.len());
    for path in paths {
        let path_buf = PathBuf::from(&path);
        let name = file_name_of(&path_buf);
        let outcome = if path_buf.is_dir() {
            Err("폴더는 체크섬을 계산할 수 없습니다.".to_string())
        } else {
            hash_file(&path_buf, &algorithms, cancel)
        };

        match outcome {
            Ok(hashes) => results.push(ChecksumFileResult {
                path,
                name,
                hashes: hashes
                    .into_iter()
                    .map(|(algorithm, value)| ChecksumValue {
                        algorithm: algorithm.as_str().to_string(),
                        value,
                    })
                    .collect(),
                error: None,
            }),
            Err(error) if error == CHECKSUM_CANCELLED => return Err(error),
            Err(error) => results.push(ChecksumFileResult {
                path,
                name,
                hashes: Vec::new(),
                error: Some(error),
            }),
        }
    }
    Ok(results)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn compute_checksums(
    paths: Vec<String>,
    algorithms: Vec<String>,
    job_id: String,
) -> Result<Vec<ChecksumFileResult>, String> {
    if paths.is_empty() {
        return Err("No files to checksum.".to_string());
    }
    let mut parsed = Vec::new();
    for algorithm in &algorithms {
        let algorithm = ChecksumAlgorithm::parse(algorithm)?;
        if !parsed.contains(&algorithm) {
            parsed.push(algorithm);
        }
    }
    if parsed.is_empty() {
        return Err("No checksum algorithm selected.".to_string());
    }

    let guard = CancelGuard::register(&job_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        compute_checksums_blocking(paths, parsed, &guard.flag)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub fn cancel_checksum(job_id: String) -> Result<(), String> {
    let registry = cancel_registry()
        .lock()
        .map_err(|_| "Checksum state is unavailable.".to_string())?;
    if let Some(flag) = registry.get(&job_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[derive(Debug, PartialEq, Eq)]
struct ParsedChecksumLine {
    name: String,
    expected: String,
    algorithm: ChecksumAlgorithm,
}

fn parse_checksum_text(text: &str, is_sfv: bool) -> Vec<ParsedChecksumLine> {
    let bsd =
        Regex::new(r"^([A-Za-z0-9-]+)\s*\((.+)\)\s*=\s*([0-9a-fA-F]+)$").expect("valid regex");
    let gnu = Regex::new(r"^([0-9a-fA-F]+)\s+[ *]?(.+)$").expect("valid regex");
    let sfv = Regex::new(r"^(.+?)\s+([0-9a-fA-F]{8})$").expect("valid regex");

    text.trim_start_matches('\u{feff}')
        .lines()
        .filter_map(|raw| {
            let line = raw.trim();
            if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
                return None;
            }
            if is_sfv {
                let captures = sfv.captures(line)?;
                return Some(ParsedChecksumLine {
                    name: captures[1].to_string(),
                    expected: captures[2].to_ascii_lowercase(),
                    algorithm: ChecksumAlgorithm::Crc32,
                });
            }
            if let Some(captures) = bsd.captures(line) {
                let algorithm = ChecksumAlgorithm::from_bsd_label(&captures[1])?;
                return Some(ParsedChecksumLine {
                    name: captures[2].to_string(),
                    expected: captures[3].to_ascii_lowercase(),
                    algorithm,
                });
            }
            let captures = gnu.captures(line)?;
            let algorithm = ChecksumAlgorithm::from_hex_len(captures[1].len())?;
            Some(ParsedChecksumLine {
                name: captures[2].to_string(),
                expected: captures[1].to_ascii_lowercase(),
                algorithm,
            })
        })
        .collect()
}

// 체크섬 파일 폴더 밖을 가리키는 이름(절대 경로, ..)은 확인 대상에서 막는다.
fn resolve_listed_path(base_dir: &Path, name: &str) -> Result<PathBuf, String> {
    let relative = Path::new(name);
    let escapes = relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_)));
    if escapes {
        return Err("체크섬 파일 폴더 밖의 경로는 확인하지 않습니다.".to_string());
    }
    Ok(base_dir.join(relative))
}

#[derive(Serialize, Debug)]
pub struct ChecksumVerifyEntry {
    pub name: String,
    pub path: String,
    pub algorithm: String,
    pub expected: String,
    pub actual: Option<String>,
    // ok | mismatch | missing | error
    pub status: String,
    pub error: Option<String>,
}

fn verify_checksum_file_blocking(
    checksum_path: String,
    cancel: &AtomicBool,
) -> Result<Vec<ChecksumVerifyEntry>, String> {
    let checksum_path = PathBuf::from(checksum_path);
    let metadata = std::fs::metadata(&checksum_path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() > MAX_CHECKSUM_FILE_BYTES {
        return Err("체크섬 파일을 읽을 수 없습니다(파일이 아니거나 너무 큽니다).".to_string());
    }
    let bytes = std::fs::read(&checksum_path).map_err(|error| error.to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    let is_sfv = checksum_path
        .extension()
        .map(|extension| extension.eq_ignore_ascii_case("sfv"))
        .unwrap_or(false);
    let lines = parse_checksum_text(&text, is_sfv);
    if lines.is_empty() {
        return Err("인식할 수 있는 체크섬 항목이 없습니다.".to_string());
    }
    let base_dir = checksum_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();

    let mut entries = Vec::with_capacity(lines.len());
    for line in lines {
        let mut entry = ChecksumVerifyEntry {
            name: line.name.clone(),
            path: String::new(),
            algorithm: line.algorithm.as_str().to_string(),
            expected: line.expected.clone(),
            actual: None,
            status: "error".to_string(),
            error: None,
        };
        match resolve_listed_path(&base_dir, &line.name) {
            Err(error) => entry.error = Some(error),
            Ok(path) => {
                entry.path = path.to_string_lossy().into_owned();
                if !path.is_file() {
                    entry.status = "missing".to_string();
                } else {
                    match hash_file(&path, &[line.algorithm], cancel) {
                        Ok(hashes) => {
                            let actual = hashes.into_iter().next().map(|(_, value)| value);
                            entry.status = if actual.as_deref() == Some(line.expected.as_str()) {
                                "ok"
                            } else {
                                "mismatch"
                            }
                            .to_string();
                            entry.actual = actual;
                        }
                        Err(error) if error == CHECKSUM_CANCELLED => return Err(error),
                        Err(error) => entry.error = Some(error),
                    }
                }
            }
        }
        entries.push(entry);
    }
    Ok(entries)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn verify_checksum_file(
    checksum_path: String,
    job_id: String,
) -> Result<Vec<ChecksumVerifyEntry>, String> {
    let guard = CancelGuard::register(&job_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        verify_checksum_file_blocking(checksum_path, &guard.flag)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
#[path = "checksum_tests.rs"]
mod tests;
