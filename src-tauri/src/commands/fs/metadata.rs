use encoding_rs::EUC_KR;
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[cfg(target_os = "macos")]
use std::os::macos::fs::MetadataExt;

const MAX_PREVIEW_BYTES: u64 = 100 * 1024;

#[derive(Serialize)]
pub struct FileEntry {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) kind: String,
    pub(crate) size: Option<u64>,
    #[serde(rename = "lastModified")]
    pub(crate) last_modified: Option<u64>,
    #[serde(rename = "isHidden")]
    pub(crate) is_hidden: bool,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn list_directory(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.is_dir() {
        return Err(format!("{path} is not a directory"));
    }

    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();

    if let Some(parent) = dir_path.parent() {
        files.push(FileEntry {
            name: "..".to_string(),
            path: parent.to_string_lossy().to_string(),
            kind: "directory".to_string(),
            size: None,
            last_modified: None,
            is_hidden: false,
        });
    }

    for entry in entries.flatten() {
        let metadata = entry.metadata().map_err(|e| e.to_string());
        let file_name = entry.file_name().to_string_lossy().to_string();
        let file_path = entry.path().to_string_lossy().to_string();

        if let Ok(meta) = metadata {
            let is_hidden = is_hidden_entry(&file_name, &meta);

            if is_hidden && !show_hidden {
                continue;
            }

            let kind = if meta.is_dir() {
                "directory".to_string()
            } else if meta.is_symlink() {
                "symlink".to_string()
            } else {
                "file".to_string()
            };

            let size = if meta.is_dir() {
                None
            } else {
                Some(meta.len())
            };

            let last_modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64);

            files.push(FileEntry {
                name: file_name,
                path: file_path,
                kind,
                size,
                last_modified,
                is_hidden,
            });
        }
    }

    files.sort_by(|a, b| {
        if a.name == ".." {
            return std::cmp::Ordering::Less;
        }
        if b.name == ".." {
            return std::cmp::Ordering::Greater;
        }
        if a.kind != b.kind {
            if a.kind == "directory" {
                return std::cmp::Ordering::Less;
            } else if b.kind == "directory" {
                return std::cmp::Ordering::Greater;
            }
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });

    Ok(files)
}

pub(crate) fn is_hidden_entry(file_name: &str, metadata: &fs::Metadata) -> bool {
    if file_name == "." || file_name == ".." {
        return false;
    }

    if file_name.starts_with('.') {
        return true;
    }

    #[cfg(target_os = "macos")]
    {
        const UF_HIDDEN: u32 = 0x0000_8000;
        metadata.st_flags() & UF_HIDDEN != 0
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = metadata;
        false
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn read_file_content(path: String) -> Result<String, String> {
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;

    let mut buffer = Vec::new();
    file.take(MAX_PREVIEW_BYTES)
        .read_to_end(&mut buffer)
        .map_err(|e| e.to_string())?;

    Ok(decode_preview_bytes(&buffer))
}

pub(crate) fn decode_preview_bytes(bytes: &[u8]) -> String {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        return decode_utf16_bytes(&bytes[2..], true);
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        return decode_utf16_bytes(&bytes[2..], false);
    }

    if looks_like_utf16_le(bytes) {
        return decode_utf16_bytes(bytes, true);
    }

    if looks_like_utf16_be(bytes) {
        return decode_utf16_bytes(bytes, false);
    }

    match String::from_utf8(bytes.to_vec()) {
        Ok(text) => text,
        Err(_) => {
            if let Some(text) = try_decode_korean_legacy_text(bytes) {
                return text;
            }

            String::from_utf8_lossy(bytes).into_owned()
        }
    }
}

fn decode_utf16_bytes(bytes: &[u8], little_endian: bool) -> String {
    let units = bytes
        .chunks_exact(2)
        .map(|chunk| {
            if little_endian {
                u16::from_le_bytes([chunk[0], chunk[1]])
            } else {
                u16::from_be_bytes([chunk[0], chunk[1]])
            }
        })
        .collect::<Vec<u16>>();

    String::from_utf16_lossy(&units)
}

fn looks_like_utf16_le(bytes: &[u8]) -> bool {
    looks_like_utf16_with_zero_stride(bytes, true)
}

fn looks_like_utf16_be(bytes: &[u8]) -> bool {
    looks_like_utf16_with_zero_stride(bytes, false)
}

fn looks_like_utf16_with_zero_stride(bytes: &[u8], zero_on_odd: bool) -> bool {
    let sample_len = bytes.len().min(64);
    if sample_len < 4 {
        return false;
    }

    let pairs = bytes[..sample_len].chunks_exact(2);
    let pair_count = pairs.len();
    if pair_count < 2 {
        return false;
    }

    let mut zero_matches = 0usize;
    let mut printable_matches = 0usize;

    for pair in pairs {
        let [first, second] = [pair[0], pair[1]];
        let zero_byte = if zero_on_odd { second } else { first };
        let text_byte = if zero_on_odd { first } else { second };

        if zero_byte == 0 {
            zero_matches += 1;
        }

        if text_byte == b'\n'
            || text_byte == b'\r'
            || text_byte == b'\t'
            || (0x20..=0x7E).contains(&text_byte)
        {
            printable_matches += 1;
        }
    }

    zero_matches * 2 >= pair_count && printable_matches * 2 >= pair_count
}

fn try_decode_korean_legacy_text(bytes: &[u8]) -> Option<String> {
    let (decoded, _, had_errors) = EUC_KR.decode(bytes);
    if had_errors {
        return None;
    }

    let text = decoded.into_owned();
    if contains_hangul(&text) {
        return Some(text);
    }

    None
}

fn contains_hangul(text: &str) -> bool {
    text.chars().any(|ch| {
        matches!(
            ch as u32,
            0x1100..=0x11FF
                | 0x3130..=0x318F
                | 0xA960..=0xA97F
                | 0xAC00..=0xD7A3
                | 0xD7B0..=0xD7FF
        )
    })
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_dir_size(path: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || compute_path_size(&path))
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

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn get_dir_size_with_du(path: &str) -> Result<u64, String> {
    use std::process::Command;

    let output = Command::new("du")
        .arg("-sk")
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let size_kb = stdout
        .split_whitespace()
        .next()
        .ok_or_else(|| "Failed to parse `du` output".to_string())?
        .parse::<u64>()
        .map_err(|e| e.to_string())?;

    Ok(size_kb * 1024)
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
