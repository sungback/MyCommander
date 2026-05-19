use encoding_rs::EUC_KR;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

const MAX_PREVIEW_BYTES: u64 = 100 * 1024;
const MAX_EXPLICIT_PREVIEW_BYTES: u64 = 5 * 1024 * 1024;
const TOO_LARGE_PREVIEW_ERROR: &str =
    "파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다.";

pub async fn read_file_content(path: String, max_bytes: Option<u64>) -> Result<String, String> {
    read_preview_file_content(Path::new(&path), preview_read_limit(max_bytes))
}

#[derive(Clone, Copy)]
struct PreviewReadLimit {
    bytes: u64,
    enforce: bool,
}

fn preview_read_limit(max_bytes: Option<u64>) -> PreviewReadLimit {
    match max_bytes {
        Some(bytes) => PreviewReadLimit {
            bytes: bytes.clamp(1, MAX_EXPLICIT_PREVIEW_BYTES),
            enforce: true,
        },
        None => PreviewReadLimit {
            bytes: MAX_PREVIEW_BYTES,
            enforce: false,
        },
    }
}

fn read_preview_file_content(path: &Path, limit: PreviewReadLimit) -> Result<String, String> {
    let path = validate_preview_read_path(path)?;
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;

    let mut buffer = Vec::new();
    let read_limit = limit.bytes + u64::from(limit.enforce);
    file.take(read_limit)
        .read_to_end(&mut buffer)
        .map_err(|e| e.to_string())?;

    if limit.enforce && buffer.len() as u64 > limit.bytes {
        return Err(TOO_LARGE_PREVIEW_ERROR.to_string());
    }

    Ok(decode_preview_bytes(&buffer))
}

#[cfg(test)]
pub(crate) fn read_preview_file_content_for_test(
    path: &Path,
    max_bytes: Option<u64>,
) -> Result<String, String> {
    read_preview_file_content(path, preview_read_limit(max_bytes))
}

pub(super) fn validate_preview_read_path(path: &Path) -> Result<PathBuf, String> {
    let resolved_path = path.canonicalize().map_err(|e| e.to_string())?;

    if is_asset_denied_home_path(&resolved_path) {
        return Err(format!(
            "Preview access is not allowed for {}",
            resolved_path.display()
        ));
    }

    Ok(resolved_path)
}

fn is_asset_denied_home_path(path: &Path) -> bool {
    let Some(home_dir) = dirs::home_dir() else {
        return false;
    };

    if path_matches_denied_home_path(path, &home_dir) {
        return true;
    }

    home_dir
        .canonicalize()
        .ok()
        .is_some_and(|home_dir| path_matches_denied_home_path(path, &home_dir))
}

pub(crate) fn path_matches_denied_home_path(path: &Path, home_dir: &Path) -> bool {
    let Ok(relative_path) = path.strip_prefix(home_dir) else {
        return false;
    };
    let components = relative_path
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>();

    if components.is_empty() {
        return false;
    }

    let first = components[0].as_ref();
    if [".ssh", ".gnupg", ".aws", ".kube"]
        .iter()
        .any(|name| first.eq_ignore_ascii_case(name))
    {
        return true;
    }

    components.len() >= 2
        && first.eq_ignore_ascii_case("Library")
        && components[1].eq_ignore_ascii_case("Keychains")
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
        Err(_) => try_decode_korean_legacy_text(bytes)
            .unwrap_or_else(|| String::from_utf8_lossy(bytes).into_owned()),
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
