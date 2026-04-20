use encoding_rs::EUC_KR;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ffi::OsString;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::UNIX_EPOCH;
use tauri::Emitter;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub operation: String,
    pub current: u64,
    pub total: u64,
    pub current_file: String,
    pub unit: String,
}

#[cfg(target_os = "macos")]
use std::os::macos::fs::MetadataExt;
#[cfg(target_os = "macos")]
use trash::macos::{DeleteMethod, TrashContextExtMacos};

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    kind: String, // "file", "directory", "symlink"
    size: Option<u64>,
    #[serde(rename = "lastModified")]
    last_modified: Option<u64>,
    #[serde(rename = "isHidden")]
    is_hidden: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BatchRenameOperation {
    old_path: String,
    new_path: String,
}

#[derive(Clone)]
struct PreparedBatchRenameOperation {
    old_path: PathBuf,
    new_path: PathBuf,
    temp_path: PathBuf,
}

static ZIP_OPERATION_STATE: OnceLock<Mutex<Option<Arc<AtomicBool>>>> = OnceLock::new();
const MAX_PREVIEW_BYTES: u64 = 100 * 1024;

fn zip_operation_state() -> &'static Mutex<Option<Arc<AtomicBool>>> {
    ZIP_OPERATION_STATE.get_or_init(|| Mutex::new(None))
}

fn begin_zip_operation() -> Result<Arc<AtomicBool>, String> {
    let mut state = zip_operation_state()
        .lock()
        .map_err(|_| "Failed to lock zip operation state".to_string())?;

    if state.is_some() {
        return Err("Another archive operation is already in progress.".to_string());
    }

    let cancel_flag = Arc::new(AtomicBool::new(false));
    *state = Some(cancel_flag.clone());
    Ok(cancel_flag)
}

fn end_zip_operation(cancel_flag: &Arc<AtomicBool>) {
    if let Ok(mut state) = zip_operation_state().lock() {
        if state
            .as_ref()
            .is_some_and(|active_flag| Arc::ptr_eq(active_flag, cancel_flag))
        {
            *state = None;
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn list_directory(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.is_dir() {
        return Err(format!("{} is not a directory", path));
    }

    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();

    // Add parent directory ".." if not root
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

    for entry in entries {
        if let Ok(entry) = entry {
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
    }

    // Sort: directories first, then alphabetical
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

fn is_hidden_entry(file_name: &str, metadata: &fs::Metadata) -> bool {
    if file_name == "." || file_name == ".." {
        return false;
    }

    if file_name.starts_with('.') {
        return true;
    }

    #[cfg(target_os = "macos")]
    {
        const UF_HIDDEN: u32 = 0x0000_8000;
        return metadata.st_flags() & UF_HIDDEN != 0;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = metadata;
        false
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_file(path: String) -> Result<(), String> {
    fs::File::create(&path)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_files(
    app: tauri::AppHandle,
    paths: Vec<String>,
    permanent: bool,
) -> Result<(), String> {
    delete_files_with_cancel(app, paths, permanent, None).await
}

pub async fn delete_files_with_cancel(
    app: tauri::AppHandle,
    paths: Vec<String>,
    permanent: bool,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<(), String> {
    delete_files_with_cancel_and_progress(paths, permanent, cancel_flag, move |payload| {
        let _ = app.emit("fs-progress", payload);
    })
    .await
}

pub async fn delete_files_with_cancel_and_progress<F>(
    paths: Vec<String>,
    permanent: bool,
    cancel_flag: Option<Arc<AtomicBool>>,
    emit_progress: F,
) -> Result<(), String>
where
    F: Fn(ProgressPayload) + Send + 'static,
{
    let targets = collect_delete_progress_targets(paths);

    tokio::task::spawn_blocking(move || delete_files_blocking(targets, permanent, cancel_flag, emit_progress))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn apply_batch_rename(operations: Vec<BatchRenameOperation>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || apply_batch_rename_operations(operations))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn copy_files(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_path: String,
    keep_both: Option<bool>,
) -> Result<Vec<String>, String> {
    copy_files_with_cancel(app, source_paths, target_path, keep_both, None).await
}

pub async fn copy_files_with_cancel(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_path: String,
    keep_both: Option<bool>,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<Vec<String>, String> {
    copy_files_with_cancel_and_progress(source_paths, target_path, keep_both, cancel_flag, move |payload| {
        let _ = app.emit("fs-progress", payload);
    })
    .await
}

pub async fn copy_files_with_cancel_and_progress<F>(
    source_paths: Vec<String>,
    target_path: String,
    keep_both: Option<bool>,
    cancel_flag: Option<Arc<AtomicBool>>,
    emit_progress: F,
) -> Result<Vec<String>, String>
where
    F: Fn(ProgressPayload) + Send + 'static,
{
    let keep_both = keep_both.unwrap_or(false);
    let total = source_paths.len() as u64;
    tokio::task::spawn_blocking(move || {
        if source_paths.is_empty() {
            return Ok(vec![]);
        }

        if is_operation_cancelled(cancel_flag.as_deref()) {
            return Err("Operation cancelled.".to_string());
        }

        if source_paths.len() == 1 {
            let file_name = Path::new(&source_paths[0])
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| source_paths[0].clone());
            let saved = copy_single_path(Path::new(&source_paths[0]), &target_path, keep_both)?;
            emit_progress(ProgressPayload {
                operation: "copy".to_string(),
                current: 1,
                total,
                current_file: file_name,
                unit: "items".to_string(),
            });
            return Ok(vec![saved]);
        }

        let target_root = Path::new(&target_path);
        fs::create_dir_all(target_root).map_err(|e| e.to_string())?;
        if !target_root.is_dir() {
            return Err(format!("{target_path} is not a directory"));
        }

        let mut saved_names = Vec::with_capacity(source_paths.len());
        for (i, source) in source_paths.iter().enumerate() {
            if is_operation_cancelled(cancel_flag.as_deref()) {
                return Err("Operation cancelled.".to_string());
            }
            let file_name = Path::new(source)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| source.clone());
            let saved = copy_path_into_dir(Path::new(source), target_root, keep_both)?;
            saved_names.push(saved);
            emit_progress(ProgressPayload {
                operation: "copy".to_string(),
                current: (i + 1) as u64,
                total,
                current_file: file_name,
                unit: "items".to_string(),
            });
        }
        Ok(saved_names)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn move_files(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_dir: String,
) -> Result<(), String> {
    move_files_with_cancel(app, source_paths, target_dir, None).await
}

pub async fn move_files_with_cancel(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_dir: String,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<(), String> {
    move_files_with_cancel_and_progress(source_paths, target_dir, cancel_flag, move |payload| {
        let _ = app.emit("fs-progress", payload);
    })
    .await
}

pub async fn move_files_with_cancel_and_progress<F>(
    source_paths: Vec<String>,
    target_dir: String,
    cancel_flag: Option<Arc<AtomicBool>>,
    emit_progress: F,
) -> Result<(), String>
where
    F: Fn(ProgressPayload) + Send + 'static,
{
    let total = source_paths.len() as u64;
    for (i, path) in source_paths.iter().enumerate() {
        if is_operation_cancelled(cancel_flag.as_deref()) {
            return Err("Operation cancelled.".to_string());
        }
        let src = Path::new(path);
        if let Some(file_name) = src.file_name() {
            let file_name_str = file_name.to_string_lossy().to_string();
            let dest = Path::new(&target_dir).join(file_name);

            // 같은 경로로 이동하는 경우 에러 반환
            if src == dest {
                return Err(format!("이미 같은 위치에 있습니다: {}", file_name_str));
            }
            // canonical path 비교 (심볼릭 링크 등 고려)
            if let (Ok(src_c), Ok(dest_c)) = (src.canonicalize(), dest.canonicalize()) {
                if src_c == dest_c {
                    return Err(format!("이미 같은 위치에 있습니다: {}", file_name_str));
                }
            }

            fs::rename(src, &dest).map_err(|e| e.to_string())?;
            emit_progress(ProgressPayload {
                operation: "move".to_string(),
                current: (i + 1) as u64,
                total,
                current_file: file_name_str,
                unit: "items".to_string(),
            });
        }
    }
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn extract_zip(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || extract_zip_archive(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_zip(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let cancel_flag = begin_zip_operation()?;
    tokio::task::spawn_blocking(move || {
        let result = create_zip_archive(&app, &path, &cancel_flag);
        end_zip_operation(&cancel_flag);
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_zip_from_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
    target_dir: String,
    archive_name: String,
) -> Result<String, String> {
    let cancel_flag = begin_zip_operation()?;
    tokio::task::spawn_blocking(move || {
        let result =
            create_zip_archive_from_paths(&app, &paths, &target_dir, &archive_name, &cancel_flag);
        end_zip_operation(&cancel_flag);
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub fn cancel_zip_operation() -> Result<(), String> {
    let state = zip_operation_state()
        .lock()
        .map_err(|_| "Failed to lock zip operation state".to_string())?;

    if let Some(cancel_flag) = state.as_ref() {
        cancel_flag.store(true, Ordering::SeqCst);
    }

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn read_file_content(path: String) -> Result<String, String> {
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;

    // Read only first 100KB to prevent UI lag on huge files
    let mut buffer = Vec::new();
    file.take(MAX_PREVIEW_BYTES)
        .read_to_end(&mut buffer)
        .map_err(|e| e.to_string())?;

    Ok(decode_preview_bytes(&buffer))
}

fn decode_preview_bytes(bytes: &[u8]) -> String {
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

fn compute_path_size(path: &str) -> Result<u64, String> {
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

fn extract_zip_archive(path: &str) -> Result<String, String> {
    use std::process::Command;

    let archive_path = Path::new(path);
    if !archive_path.is_file() {
        return Err(format!("{path} is not a file"));
    }

    let extension = archive_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default();
    if !extension.eq_ignore_ascii_case("zip") {
        return Err(format!("{path} is not a zip archive"));
    }

    let target_dir = get_unique_extraction_dir(archive_path)?;

    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    {
        let ditto_output = Command::new("ditto")
            .args(["-x", "-k"])
            .arg(archive_path)
            .arg(&target_dir)
            .output()
            .map_err(|e| {
                format!(
                    "Failed to run ditto while extracting archive into {}: {e}",
                    target_dir.display()
                )
            })?;

        if !ditto_output.status.success() {
            let ditto_error = format_command_failure("ditto", &ditto_output);

            let _ = fs::remove_dir_all(&target_dir);
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

            let unzip_output = Command::new("unzip")
                .args(["-q"])
                .arg(archive_path)
                .args(["-d"])
                .arg(&target_dir)
                .output()
                .map_err(|e| {
                    format!(
                        "Failed to run unzip fallback while extracting archive into {} after {ditto_error}: {e}",
                        target_dir.display()
                    )
                })?;

            if !unzip_output.status.success() {
                let _ = fs::remove_dir_all(&target_dir);
                let problem = describe_invalid_zip_problem([&ditto_output, &unzip_output]);
                return Err(format!(
                    "Failed to extract archive into {}. {} {ditto_error}; fallback {}",
                    target_dir.display(),
                    problem,
                    format_command_failure("unzip", &unzip_output)
                ));
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = Command::new("unzip")
            .args(["-q"])
            .arg(archive_path)
            .args(["-d"])
            .arg(&target_dir)
            .output()
            .map_err(|e| {
                format!(
                    "Failed to run unzip while extracting archive into {}: {e}",
                    target_dir.display()
                )
            })?;

        if !output.status.success() {
            let _ = fs::remove_dir_all(&target_dir);
            let problem = describe_invalid_zip_problem([&output]);
            return Err(format!(
                "Failed to extract archive into {}. {} {}",
                target_dir.display(),
                problem,
                format_command_failure("unzip", &output)
            ));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1]",
            ])
            .arg(archive_path)
            .arg(&target_dir)
            .output()
            .map_err(|e| {
                format!(
                    "Failed to run PowerShell while extracting archive into {}: {e}",
                    target_dir.display()
                )
            })?;

        if !output.status.success() {
            let _ = fs::remove_dir_all(&target_dir);
            let problem = describe_invalid_zip_problem([&output]);
            return Err(format!(
                "Failed to extract archive into {}. {} {}",
                target_dir.display(),
                problem,
                format_command_failure("powershell", &output)
            ));
        }
    }

    flatten_matching_archive_root_dir(&target_dir, archive_path)?;

    Ok(target_dir.to_string_lossy().to_string())
}

fn flatten_matching_archive_root_dir(
    extraction_dir: &Path,
    archive_path: &Path,
) -> Result<(), String> {
    let top_level_entries = fs::read_dir(extraction_dir)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if top_level_entries.len() != 1 {
        return Ok(());
    }

    let nested_root = &top_level_entries[0];
    if !nested_root.file_type().map_err(|e| e.to_string())?.is_dir() {
        return Ok(());
    }

    let nested_name = nested_root.file_name();
    let matches_archive_name = archive_path
        .file_stem()
        .is_some_and(|archive_stem| archive_stem == nested_name.as_os_str());
    let matches_target_name = extraction_dir
        .file_name()
        .is_some_and(|target_name| target_name == nested_name.as_os_str());

    if !matches_archive_name && !matches_target_name {
        return Ok(());
    }

    move_directory_contents(nested_root.path().as_path(), extraction_dir)?;
    fs::remove_dir(nested_root.path()).map_err(|e| e.to_string())
}

fn move_directory_contents(source_dir: &Path, target_dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(source_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let destination = target_dir.join(entry.file_name());
        fs::rename(entry.path(), destination).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn format_command_failure(command_name: &str, output: &std::process::Output) -> String {
    let status = output
        .status
        .code()
        .map(|code| code.to_string())
        .unwrap_or_else(|| "terminated by signal".to_string());
    let stderr = compact_command_output(&output.stderr);
    let stdout = compact_command_output(&output.stdout);
    let mut details = Vec::new();

    if let Some(stderr) = stderr {
        details.push(format!("stderr: {stderr}"));
    }
    if let Some(stdout) = stdout {
        details.push(format!("stdout: {stdout}"));
    }

    if details.is_empty() {
        format!("{command_name} exited with status {status}")
    } else {
        format!(
            "{command_name} exited with status {status} ({})",
            details.join(" | ")
        )
    }
}

fn compact_command_output(output: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(output);
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.is_empty() {
        None
    } else {
        Some(compact)
    }
}

fn describe_invalid_zip_problem<'a, I>(outputs: I) -> &'static str
where
    I: IntoIterator<Item = &'a std::process::Output>,
{
    if outputs
        .into_iter()
        .any(command_output_indicates_invalid_zip)
    {
        "Archive appears to be corrupted or incomplete."
    } else {
        "Archive extraction failed."
    }
}

fn command_output_indicates_invalid_zip(output: &std::process::Output) -> bool {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    indicates_invalid_zip_message(&stderr) || indicates_invalid_zip_message(&stdout)
}

fn indicates_invalid_zip_message(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();

    lower.contains("pkzip signature")
        || lower.contains("end-of-central-directory signature not found")
        || lower.contains("cannot find zipfile directory")
        || lower.contains("not a zip archive")
        || lower.contains("central directory")
}

fn create_zip_archive(
    app: &tauri::AppHandle,
    path: &str,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<String, String> {
    let source_dir = validate_zip_source_directory(path)?;
    let archive_path = get_unique_archive_path(&source_dir)?;
    let total_entries = count_zip_entries_for_directory_contents(&source_dir)?;

    create_zip_archive_with_zip_command(
        app,
        source_dir.clone(),
        archive_path,
        vec![".".to_string()],
        total_entries,
        cancel_flag,
    )
}

fn validate_zip_source_directory(path: &str) -> Result<PathBuf, String> {
    let source_dir = PathBuf::from(path);
    if !source_dir.is_dir() {
        return Err(format!("{path} is not a directory"));
    }

    Ok(source_dir)
}

fn get_unique_extraction_dir(archive_path: &Path) -> Result<PathBuf, String> {
    let parent_dir = archive_path.parent().ok_or_else(|| {
        format!(
            "Could not find parent directory for {}",
            archive_path.display()
        )
    })?;
    let stem = archive_path
        .file_stem()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("Archive");

    let initial_target = parent_dir.join(stem);
    if !initial_target.exists() {
        return Ok(initial_target);
    }

    for suffix in 2.. {
        let candidate = parent_dir.join(format!("{stem} {suffix}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Could not find a unique extraction directory for {}",
        archive_path.display()
    ))
}

fn get_unique_archive_path(source_dir: &Path) -> Result<PathBuf, String> {
    let parent_dir = source_dir.parent().ok_or_else(|| {
        format!(
            "Could not find parent directory for {}",
            source_dir.display()
        )
    })?;
    let stem = source_dir
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("Archive");

    let initial_target = parent_dir.join(format!("{stem}.zip"));
    if !initial_target.exists() {
        return Ok(initial_target);
    }

    for suffix in 2.. {
        let candidate = parent_dir.join(format!("{stem} {suffix}.zip"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Could not find a unique archive path for {}",
        source_dir.display()
    ))
}

fn get_unique_archive_path_named(target_dir: &Path, stem: &str) -> Result<PathBuf, String> {
    let initial = target_dir.join(format!("{stem}.zip"));
    if !initial.exists() {
        return Ok(initial);
    }
    for suffix in 2.. {
        let candidate = target_dir.join(format!("{stem} {suffix}.zip"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(format!("Could not find a unique archive path for {stem}"))
}

fn create_zip_archive_from_paths(
    app: &tauri::AppHandle,
    paths: &[String],
    target_dir: &str,
    archive_name: &str,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<String, String> {
    if paths.is_empty() {
        return Err("No paths provided".to_string());
    }

    let target_dir_path = Path::new(target_dir);
    let stem = if archive_name.is_empty() {
        "Archive"
    } else {
        archive_name
    };
    let archive_path = get_unique_archive_path_named(target_dir_path, stem)?;
    let entry_names = paths
        .iter()
        .filter_map(|raw_path| {
            let path = PathBuf::from(raw_path);
            if !path.exists() {
                return None;
            }

            path.file_name()
                .map(|name| name.to_string_lossy().to_string())
        })
        .collect::<Vec<_>>();

    if entry_names.is_empty() {
        return Err("No valid paths to compress".to_string());
    }

    let total_entries = count_zip_entries_for_named_paths(target_dir_path, &entry_names)?;

    create_zip_archive_with_zip_command(
        app,
        target_dir_path.to_path_buf(),
        archive_path,
        entry_names,
        total_entries,
        cancel_flag,
    )
}

fn count_zip_entries_for_directory_contents(source_dir: &Path) -> Result<u64, String> {
    let mut total_entries = 0u64;

    for entry in walkdir::WalkDir::new(source_dir)
        .sort_by_file_name()
        .min_depth(1)
    {
        entry.map_err(|e| e.to_string())?;
        total_entries += 1;
    }

    Ok(total_entries.max(1))
}

fn count_zip_entries_for_named_paths(
    working_dir: &Path,
    entry_names: &[String],
) -> Result<u64, String> {
    let mut total_entries = 0u64;

    for entry_name in entry_names {
        let path = working_dir.join(entry_name);
        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

        if metadata.is_file() {
            total_entries += 1;
            continue;
        }

        if metadata.is_dir() {
            total_entries += 1;
            for entry in walkdir::WalkDir::new(&path)
                .sort_by_file_name()
                .min_depth(1)
            {
                entry.map_err(|e| e.to_string())?;
                total_entries += 1;
            }
        }
    }

    Ok(total_entries.max(1))
}

fn create_zip_archive_with_zip_command(
    app: &tauri::AppHandle,
    working_dir: PathBuf,
    archive_path: PathBuf,
    entries: Vec<String>,
    total_entries: u64,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<String, String> {
    use std::process::{Command, Stdio};

    let temp_archive_path = get_hidden_temp_archive_path(&archive_path)?;
    let temp_archive_arg = temp_archive_path.to_string_lossy().to_string();

    let progress_counter = Arc::new(AtomicU64::new(0));
    emit_zip_progress(app, 0, total_entries, "Preparing...");

    let mut command = Command::new("zip");
    command
        .current_dir(&working_dir)
        .args(["-r", "-1", &temp_archive_arg, "--"])
        .args(&entries)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| {
        format!(
            "Failed to start zip while creating archive at {}: {e}",
            archive_path.display()
        )
    })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture zip stdout.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture zip stderr.".to_string())?;

    let progress_counter_for_stdout = progress_counter.clone();
    let app_for_stdout = app.clone();
    let stdout_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut collected = Vec::new();

        for line_result in reader.lines() {
            match line_result {
                Ok(line) => {
                    let trimmed = line.trim().to_string();
                    if trimmed.is_empty() {
                        continue;
                    }

                    if let Some(entry_name) = parse_zip_progress_entry(&trimmed) {
                        let current =
                            progress_counter_for_stdout.fetch_add(1, Ordering::SeqCst) + 1;
                        emit_zip_progress(
                            &app_for_stdout,
                            current.min(total_entries),
                            total_entries,
                            &entry_name,
                        );
                    }

                    collected.push(trimmed);
                }
                Err(error) => {
                    collected.push(format!("stdout read error: {error}"));
                    break;
                }
            }
        }

        collected
    });

    let stderr_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let mut collected = Vec::new();

        for line_result in reader.lines() {
            match line_result {
                Ok(line) => {
                    let trimmed = line.trim().to_string();
                    if !trimmed.is_empty() {
                        collected.push(trimmed);
                    }
                }
                Err(error) => {
                    collected.push(format!("stderr read error: {error}"));
                    break;
                }
            }
        }

        collected
    });

    loop {
        if cancel_flag.load(Ordering::SeqCst) {
            let _ = child.kill();
            let _ = child.wait();
            let stdout_lines = stdout_handle.join().unwrap_or_default();
            let stderr_lines = stderr_handle.join().unwrap_or_default();
            let _ = fs::remove_file(&temp_archive_path);
            return Err(build_zip_canceled_message(&stdout_lines, &stderr_lines));
        }

        match child.try_wait().map_err(|e| e.to_string())? {
            Some(status) => {
                let stdout_lines = stdout_handle.join().unwrap_or_default();
                let stderr_lines = stderr_handle.join().unwrap_or_default();

                if !status.success() {
                    let _ = fs::remove_file(&temp_archive_path);
                    return Err(format!(
                        "Failed to create archive at {}. {}",
                        archive_path.display(),
                        build_zip_failure_details(status.code(), &stdout_lines, &stderr_lines)
                    ));
                }

                emit_zip_progress(
                    app,
                    total_entries,
                    total_entries,
                    archive_path.to_string_lossy().as_ref(),
                );
                fs::rename(&temp_archive_path, &archive_path).map_err(|e| {
                    let _ = fs::remove_file(&temp_archive_path);
                    format!(
                        "Failed to finalize archive at {}: {e}",
                        archive_path.display()
                    )
                })?;

                return Ok(archive_path.to_string_lossy().to_string());
            }
            None => std::thread::sleep(std::time::Duration::from_millis(100)),
        }
    }
}

fn parse_zip_progress_entry(line: &str) -> Option<String> {
    let stripped = line.strip_prefix("adding:")?.trim();
    let entry = stripped
        .split_once(" (")
        .map(|(name, _)| name)
        .unwrap_or(stripped)
        .trim();

    if entry.is_empty() {
        None
    } else {
        Some(entry.to_string())
    }
}

fn build_zip_failure_details(
    status_code: Option<i32>,
    stdout_lines: &[String],
    stderr_lines: &[String],
) -> String {
    let status = status_code
        .map(|code| code.to_string())
        .unwrap_or_else(|| "terminated by signal".to_string());
    let mut details = Vec::new();

    if !stderr_lines.is_empty() {
        details.push(format!("stderr: {}", stderr_lines.join(" | ")));
    }
    if !stdout_lines.is_empty() {
        details.push(format!("stdout: {}", stdout_lines.join(" | ")));
    }

    if details.is_empty() {
        format!("zip exited with status {status}")
    } else {
        format!("zip exited with status {status} ({})", details.join(" | "))
    }
}

fn build_zip_canceled_message(stdout_lines: &[String], stderr_lines: &[String]) -> String {
    let mut details = Vec::new();

    if !stderr_lines.is_empty() {
        details.push(format!("stderr: {}", stderr_lines.join(" | ")));
    }
    if !stdout_lines.is_empty() {
        details.push(format!("stdout: {}", stdout_lines.join(" | ")));
    }

    if details.is_empty() {
        "Archive creation was canceled.".to_string()
    } else {
        format!("Archive creation was canceled. {}", details.join(" | "))
    }
}

fn emit_zip_progress(app: &tauri::AppHandle, current: u64, total: u64, current_file: &str) {
    let _ = app.emit(
        "fs-progress",
        ProgressPayload {
            operation: "zip".to_string(),
            current,
            total,
            current_file: current_file.to_string(),
            unit: "items".to_string(),
        },
    );
}

fn get_hidden_temp_archive_path(archive_path: &Path) -> Result<PathBuf, String> {
    let parent_dir = archive_path.parent().ok_or_else(|| {
        format!(
            "Could not find parent directory for {}",
            archive_path.display()
        )
    })?;
    let file_name = archive_path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("Archive.zip");

    let initial = parent_dir.join(format!(".{file_name}.partial"));
    if !initial.exists() {
        return Ok(initial);
    }

    for suffix in 2.. {
        let candidate = parent_dir.join(format!(".{file_name}.partial.{suffix}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Could not find a temporary archive path for {}",
        archive_path.display()
    ))
}

fn apply_batch_rename_operations(operations: Vec<BatchRenameOperation>) -> Result<(), String> {
    let filtered_operations: Vec<BatchRenameOperation> = operations
        .into_iter()
        .filter(|operation| operation.old_path != operation.new_path)
        .collect();

    if filtered_operations.is_empty() {
        return Ok(());
    }

    let old_paths: HashSet<PathBuf> = filtered_operations
        .iter()
        .map(|operation| PathBuf::from(&operation.old_path))
        .collect();
    let mut new_paths = HashSet::new();

    for operation in &filtered_operations {
        let old_path = Path::new(&operation.old_path);
        let new_path = Path::new(&operation.new_path);

        if !old_path.exists() {
            return Err(format!(
                "Source path does not exist: {}",
                old_path.display()
            ));
        }

        if !new_paths.insert(new_path.to_path_buf()) {
            return Err(format!(
                "Multiple items cannot be renamed to the same path: {}",
                new_path.display()
            ));
        }

        if new_path.exists() && !old_paths.contains(new_path) {
            return Err(format!(
                "Target path already exists: {}",
                new_path.display()
            ));
        }
    }

    let prepared_operations = filtered_operations
        .iter()
        .enumerate()
        .map(|(index, operation)| {
            let old_path = PathBuf::from(&operation.old_path);
            let new_path = PathBuf::from(&operation.new_path);
            let temp_path = get_temporary_rename_path(&old_path, index)?;

            Ok(PreparedBatchRenameOperation {
                old_path,
                new_path,
                temp_path,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    let mut moved_to_temp = 0usize;
    for operation in &prepared_operations {
        if let Err(error) = fs::rename(&operation.old_path, &operation.temp_path) {
            rollback_temp_renames(&prepared_operations[..moved_to_temp]);
            return Err(error.to_string());
        }

        moved_to_temp += 1;
    }

    let mut moved_to_target = 0usize;
    for operation in &prepared_operations {
        if let Err(error) = fs::rename(&operation.temp_path, &operation.new_path) {
            rollback_target_renames(&prepared_operations[..moved_to_target]);
            rollback_pending_temp_renames(&prepared_operations[moved_to_target..]);
            return Err(error.to_string());
        }

        moved_to_target += 1;
    }

    Ok(())
}

fn get_temporary_rename_path(path: &Path, index: usize) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Could not find parent directory for {}", path.display()))?;
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();

    for attempt in 0..1000usize {
        let candidate = parent.join(format!(
            ".__mycommander_batch_rename_{seed}_{index}_{attempt}"
        ));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Could not create a temporary rename path for {}",
        path.display()
    ))
}

fn rollback_temp_renames(operations: &[PreparedBatchRenameOperation]) {
    for operation in operations.iter().rev() {
        let _ = fs::rename(&operation.temp_path, &operation.old_path);
    }
}

fn rollback_target_renames(operations: &[PreparedBatchRenameOperation]) {
    for operation in operations.iter().rev() {
        let _ = fs::rename(&operation.new_path, &operation.old_path);
    }
}

fn rollback_pending_temp_renames(operations: &[PreparedBatchRenameOperation]) {
    for operation in operations.iter().rev() {
        let _ = fs::rename(&operation.temp_path, &operation.old_path);
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

fn collapse_nested_paths(paths: Vec<String>) -> Vec<PathBuf> {
    let mut collapsed: Vec<PathBuf> = Vec::new();
    let mut candidates: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();

    candidates.sort_by(|a, b| {
        a.components()
            .count()
            .cmp(&b.components().count())
            .then_with(|| a.as_os_str().len().cmp(&b.as_os_str().len()))
    });

    for candidate in candidates {
        if collapsed
            .iter()
            .any(|existing| candidate == *existing || candidate.starts_with(existing))
        {
            continue;
        }

        collapsed.push(candidate);
    }

    collapsed
}

fn collect_delete_progress_targets(paths: Vec<String>) -> Vec<PathBuf> {
    collapse_nested_paths(paths)
}

fn delete_files_blocking<F>(
    targets: Vec<PathBuf>,
    permanent: bool,
    cancel_flag: Option<Arc<AtomicBool>>,
    emit_progress: F,
) -> Result<(), String>
where
    F: Fn(ProgressPayload),
{
    if targets.is_empty() {
        return Ok(());
    }

    let total = targets.len() as u64;
    emit_delete_progress(&emit_progress, 0, total, "Preparing...");

    for (index, path) in targets.iter().enumerate() {
        if is_operation_cancelled(cancel_flag.as_deref()) {
            return Err("Operation cancelled.".to_string());
        }
        let current_file = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| path.to_string_lossy().to_string());

        if permanent {
            if path.is_dir() {
                fs::remove_dir_all(path).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(path).map_err(|e| e.to_string())?;
            }
        } else {
            move_to_trash(path).map_err(|e| e.to_string())?;
        }

        emit_delete_progress(&emit_progress, index as u64 + 1, total, &current_file);
    }

    Ok(())
}

fn is_operation_cancelled(cancel_flag: Option<&AtomicBool>) -> bool {
    cancel_flag.is_some_and(|flag| flag.load(Ordering::SeqCst))
}

fn emit_delete_progress<F>(emit_progress: &F, current: u64, total: u64, current_file: &str)
where
    F: Fn(ProgressPayload),
{
    emit_progress(ProgressPayload {
        operation: "delete".to_string(),
        current,
        total,
        current_file: current_file.to_string(),
        unit: "items".to_string(),
    });
}

fn move_to_trash(path: &Path) -> Result<(), trash::Error> {
    #[cfg(target_os = "macos")]
    {
        let mut ctx = trash::TrashContext::new();
        // On macOS, avoiding Finder prevents metadata files like `.DS_Store`
        // from being recreated during the trash operation.
        ctx.set_delete_method(DeleteMethod::NsFileManager);
        return ctx.delete(path);
    }

    #[cfg(not(target_os = "macos"))]
    {
        trash::delete(path)
    }
}

fn copy_single_path(source: &Path, target_path: &str, keep_both: bool) -> Result<String, String> {
    let target = Path::new(target_path);

    if target.exists() && target.is_dir() {
        return copy_path_into_dir(source, target, keep_both);
    }

    if target_path.ends_with(std::path::MAIN_SEPARATOR)
        || target_path.ends_with('/')
        || target_path.ends_with('\\')
    {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
        return copy_path_into_dir(source, target, keep_both);
    }

    // 명시적 목적지 경로인 경우 keep_both라도 그대로 사용 (단일 파일 이름 변경 복사)
    copy_path_to_destination(source, target)?;
    Ok(target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default())
}

fn make_copy_name(source: &Path, target_dir: &Path) -> PathBuf {
    let file_name = source
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // 확장자 분리 (폴더는 확장자 없음)
    let (stem, ext_with_dot) = if source.is_dir() {
        (file_name.as_str().to_string(), String::new())
    } else {
        match source.extension() {
            Some(ext) => {
                let ext_str = ext.to_string_lossy().to_string();
                let stem_str = source
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                (stem_str, format!(".{ext_str}"))
            }
            None => (file_name.clone(), String::new()),
        }
    };

    // 기존 " copy" / " copy N" 접미사 제거하여 base stem 추출
    let base_stem = {
        let copy_n_re = regex::Regex::new(r"^(.*) copy(?: (\d+))?$").unwrap();
        if let Some(caps) = copy_n_re.captures(&stem) {
            caps.get(1)
                .map(|m| m.as_str().to_string())
                .unwrap_or(stem.clone())
        } else {
            stem.clone()
        }
    };

    // 충돌 없는 이름 탐색
    let first_candidate = target_dir.join(format!("{base_stem} copy{ext_with_dot}"));
    if !first_candidate.exists() {
        return first_candidate;
    }
    let mut n = 2u32;
    loop {
        let candidate = target_dir.join(format!("{base_stem} copy {n}{ext_with_dot}"));
        if !candidate.exists() {
            return candidate;
        }
        n += 1;
    }
}

/// 파일을 디렉터리에 복사하고 실제로 저장된 파일명을 반환합니다.
/// keep_both = true 이면 목적지에 같은 이름이 있을 때 자동으로 "copy" 이름을 생성합니다.
fn copy_path_into_dir(source: &Path, target_dir: &Path, keep_both: bool) -> Result<String, String> {
    let file_name = source
        .file_name()
        .ok_or_else(|| format!("Could not determine file name for {}", source.display()))?;

    let same_folder = source.parent().map(|p| p == target_dir).unwrap_or(false);

    let destination = if same_folder || (keep_both && target_dir.join(file_name).exists()) {
        // 같은 폴더이거나, keep_both 모드에서 이미 파일이 존재하면 자동 이름 생성
        make_copy_name(source, target_dir)
    } else {
        target_dir.join(file_name)
    };

    let saved_name = destination
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    copy_path_to_destination(source, &destination)?;
    Ok(saved_name)
}

fn copy_path_to_destination(source: &Path, destination: &Path) -> Result<(), String> {
    let source_metadata = fs::metadata(source).map_err(|e| e.to_string())?;
    let source_link_metadata = fs::symlink_metadata(source).map_err(|e| e.to_string())?;
    let source_canonical = source.canonicalize().map_err(|e| e.to_string())?;

    if destination.exists() {
        let destination_canonical = destination.canonicalize().map_err(|e| e.to_string())?;
        if destination_canonical == source_canonical {
            return Err(format!(
                "Source and destination are the same: {}",
                source.display()
            ));
        }
    }

    if source_link_metadata.file_type().is_symlink() && source_metadata.is_dir() {
        return Err(format!(
            "Copying directory symlinks is not supported yet: {}",
            source.display()
        ));
    }

    if source_metadata.is_dir() {
        let normalized_destination = normalize_target_path(destination)?;
        if normalized_destination.starts_with(&source_canonical) {
            return Err(format!(
                "Cannot copy a directory into itself: {}",
                source.display()
            ));
        }

        copy_directory_recursive(source, destination)?;
        return Ok(());
    }

    copy_file_to_destination(source, destination)
}

fn copy_directory_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    use walkdir::WalkDir;

    fs::create_dir_all(destination).map_err(|e| e.to_string())?;

    for entry in WalkDir::new(source) {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let relative_path = entry_path.strip_prefix(source).map_err(|e| e.to_string())?;

        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let destination_path = destination.join(relative_path);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&destination_path).map_err(|e| e.to_string())?;
            continue;
        }

        if entry.file_type().is_symlink() {
            let metadata = fs::metadata(entry_path).map_err(|e| e.to_string())?;
            if metadata.is_dir() {
                return Err(format!(
                    "Copying directory symlinks is not supported yet: {}",
                    entry_path.display()
                ));
            }
        }

        copy_file_to_destination(entry_path, &destination_path)?;
    }

    Ok(())
}

fn copy_file_to_destination(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::copy(source, destination).map_err(|e| e.to_string())?;
    Ok(())
}

fn normalize_target_path(path: &Path) -> Result<PathBuf, String> {
    let mut existing_ancestor = path;
    let mut suffix: Vec<OsString> = Vec::new();

    while !existing_ancestor.exists() {
        let name = existing_ancestor
            .file_name()
            .ok_or_else(|| format!("Could not resolve destination path {}", path.display()))?;
        suffix.push(name.to_os_string());
        existing_ancestor = existing_ancestor
            .parent()
            .ok_or_else(|| format!("Could not resolve destination path {}", path.display()))?;
    }

    let mut resolved = existing_ancestor
        .canonicalize()
        .map_err(|e| e.to_string())?;

    for component in suffix.iter().rev() {
        resolved.push(component);
    }

    Ok(resolved)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn check_copy_conflicts(
    source_paths: Vec<String>,
    target_path: String,
) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let target = Path::new(&target_path);
        let mut conflicts = Vec::new();

        for source in &source_paths {
            let src = Path::new(source);
            let file_name = src
                .file_name()
                .ok_or_else(|| format!("Invalid path: {}", source))?;
            let destination = if target.is_dir() {
                target.join(file_name)
            } else {
                target.to_path_buf()
            };
            if destination.exists() {
                conflicts.push(file_name.to_string_lossy().to_string());
            }
        }

        Ok(conflicts)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use encoding_rs::EUC_KR;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn create_test_dir(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("mycommander_{name}_{suffix}"))
    }

    #[test]
    fn collapse_nested_removes_children() {
        let paths = vec!["/a".to_string(), "/a/b".to_string(), "/a/b/c".to_string()];
        let result = collapse_nested_paths(paths);
        assert_eq!(result, vec![PathBuf::from("/a")]);
    }

    #[test]
    fn collapse_nested_keeps_siblings() {
        let paths = vec!["/a".to_string(), "/b".to_string(), "/c".to_string()];
        let result = collapse_nested_paths(paths);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn collapse_nested_handles_overlapping_prefixes() {
        // /app should NOT collapse /a/b because /app does not start with /a/
        let paths = vec!["/a".to_string(), "/app".to_string()];
        let result = collapse_nested_paths(paths);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn collapse_nested_removes_exact_duplicate() {
        let paths = vec!["/a/b".to_string(), "/a/b".to_string()];
        let result = collapse_nested_paths(paths);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], PathBuf::from("/a/b"));
    }

    #[test]
    fn collapse_nested_empty_vec() {
        let result = collapse_nested_paths(vec![]);
        assert!(result.is_empty());
    }

    #[test]
    fn collect_delete_progress_targets_collapses_nested_entries() {
        let paths = vec![
            "/tmp/root".to_string(),
            "/tmp/root/child.txt".to_string(),
            "/tmp/other.txt".to_string(),
        ];

        let result = collect_delete_progress_targets(paths);

        assert_eq!(
            result,
            vec![PathBuf::from("/tmp/root"), PathBuf::from("/tmp/other.txt")]
        );
    }

    #[test]
    fn hidden_entry_dot_prefix() {
        let dir = std::env::temp_dir();
        let metadata = fs::metadata(&dir).unwrap();
        assert!(is_hidden_entry(".hidden", &metadata));
    }

    #[test]
    fn hidden_entry_normal_file() {
        let dir = std::env::temp_dir();
        let metadata = fs::metadata(&dir).unwrap();
        assert!(!is_hidden_entry("visible.txt", &metadata));
    }

    #[test]
    fn decode_preview_bytes_keeps_utf8_text() {
        let decoded = decode_preview_bytes("plain utf8 text".as_bytes());

        assert_eq!(decoded, "plain utf8 text");
    }

    #[test]
    fn decode_preview_bytes_decodes_utf16le_with_bom() {
        let mut bytes = vec![0xFF, 0xFE];
        for unit in "Hello UTF16".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }

        let decoded = decode_preview_bytes(&bytes);

        assert_eq!(decoded, "Hello UTF16");
    }

    #[test]
    fn decode_preview_bytes_decodes_utf16le_without_bom_when_pattern_matches() {
        let mut bytes = Vec::new();
        for unit in "Hello".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }

        let decoded = decode_preview_bytes(&bytes);

        assert_eq!(decoded, "Hello");
    }

    #[test]
    fn decode_preview_bytes_falls_back_to_lossy_utf8() {
        let decoded = decode_preview_bytes(&[0x66, 0x6f, 0x80, 0x6f]);

        assert_eq!(decoded, "fo\u{FFFD}o");
    }

    #[test]
    fn decode_preview_bytes_decodes_euc_kr_text() {
        let (bytes, _, had_errors) = EUC_KR.encode("안녕하세요");
        assert!(!had_errors);

        let decoded = decode_preview_bytes(bytes.as_ref());

        assert_eq!(decoded, "안녕하세요");
    }

    #[test]
    fn hidden_entry_dot_and_dotdot_are_not_hidden() {
        let dir = std::env::temp_dir();
        let metadata = fs::metadata(&dir).unwrap();
        assert!(!is_hidden_entry(".", &metadata));
        assert!(!is_hidden_entry("..", &metadata));
    }

    #[test]
    fn unique_extraction_dir_base_name() {
        let tmp = std::env::temp_dir().join("test_extract_unique");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let archive = tmp.join("data.zip");
        fs::write(&archive, b"").unwrap();

        let result = get_unique_extraction_dir(&archive).unwrap();
        assert_eq!(result, tmp.join("data"));

        // Clean up
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_extraction_dir_increments_suffix() {
        let tmp = std::env::temp_dir().join("test_extract_suffix");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let archive = tmp.join("data.zip");
        fs::write(&archive, b"").unwrap();

        // Create "data" dir so the first name is taken
        fs::create_dir_all(tmp.join("data")).unwrap();

        let result = get_unique_extraction_dir(&archive).unwrap();
        assert_eq!(result, tmp.join("data 2"));

        // Clean up
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_extraction_dir_handles_unicode_and_spaces() {
        let tmp = create_test_dir("extract_unicode_space");
        let parent = tmp.join("내 드라이브").join("_aaa");
        fs::create_dir_all(&parent).unwrap();

        let archive = parent.join("watchcat.zip");
        fs::write(&archive, b"").unwrap();

        let result = get_unique_extraction_dir(&archive).unwrap();
        assert_eq!(result, parent.join("watchcat"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_archive_path_base_name() {
        let tmp = std::env::temp_dir().join("test_archive_unique");
        let source = tmp.join("data");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&source).unwrap();

        let result = get_unique_archive_path(&source).unwrap();
        assert_eq!(result, tmp.join("data.zip"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_archive_path_increments_suffix() {
        let tmp = std::env::temp_dir().join("test_archive_suffix");
        let source = tmp.join("data");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&source).unwrap();
        fs::write(tmp.join("data.zip"), b"").unwrap();

        let result = get_unique_archive_path(&source).unwrap();
        assert_eq!(result, tmp.join("data 2.zip"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn flattens_single_top_level_directory_matching_archive_name() {
        let tmp = create_test_dir("flatten_archive_root");
        let extraction_dir = tmp.join("abc");
        let nested_root = extraction_dir.join("abc");
        let nested_child = nested_root.join("notes.txt");

        fs::create_dir_all(&nested_root).unwrap();
        fs::write(&nested_child, b"hello").unwrap();

        flatten_matching_archive_root_dir(&extraction_dir, Path::new("abc.zip")).unwrap();

        assert!(extraction_dir.join("notes.txt").exists());
        assert!(!nested_root.exists());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn keeps_single_top_level_directory_when_name_differs_from_archive() {
        let tmp = create_test_dir("keep_archive_root");
        let extraction_dir = tmp.join("abc");
        let nested_root = extraction_dir.join("other");
        let nested_child = nested_root.join("notes.txt");

        fs::create_dir_all(&nested_root).unwrap();
        fs::write(&nested_child, b"hello").unwrap();

        flatten_matching_archive_root_dir(&extraction_dir, Path::new("abc.zip")).unwrap();

        assert!(nested_child.exists());
        assert!(!extraction_dir.join("notes.txt").exists());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn create_zip_archive_rejects_non_directory() {
        let tmp = std::env::temp_dir().join("test_create_zip_file.txt");
        let _ = fs::remove_file(&tmp);
        fs::write(&tmp, b"hello").unwrap();

        let result = validate_zip_source_directory(tmp.to_str().unwrap());
        assert!(result.is_err());

        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn compute_path_size_for_single_file() {
        let tmp = std::env::temp_dir().join("test_size_file");
        let _ = fs::remove_file(&tmp);

        let content = b"hello world";
        fs::write(&tmp, content).unwrap();

        let size = compute_path_size(tmp.to_str().unwrap()).unwrap();
        assert_eq!(size, content.len() as u64);

        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn compute_path_size_nonexistent_path() {
        let result = compute_path_size("/nonexistent/path/that/should/not/exist");
        assert!(result.is_err());
    }

    #[test]
    fn compact_command_output_removes_extra_whitespace() {
        let result = compact_command_output(b"line one\n  line two\t\tline three  ");
        assert_eq!(result.as_deref(), Some("line one line two line three"));
    }

    #[test]
    fn indicates_invalid_zip_message_detects_missing_central_directory() {
        assert!(indicates_invalid_zip_message(
            "End-of-central-directory signature not found."
        ));
        assert!(indicates_invalid_zip_message(
            "ditto: Couldn't read pkzip signature."
        ));
        assert!(!indicates_invalid_zip_message("permission denied"));
    }

    #[test]
    fn batch_rename_swaps_file_names_safely() {
        let tmp = create_test_dir("batch_swap");
        fs::create_dir_all(&tmp).unwrap();

        let a_path = tmp.join("a.txt");
        let b_path = tmp.join("b.txt");
        fs::write(&a_path, b"alpha").unwrap();
        fs::write(&b_path, b"beta").unwrap();

        apply_batch_rename_operations(vec![
            BatchRenameOperation {
                old_path: a_path.to_string_lossy().to_string(),
                new_path: b_path.to_string_lossy().to_string(),
            },
            BatchRenameOperation {
                old_path: b_path.to_string_lossy().to_string(),
                new_path: a_path.to_string_lossy().to_string(),
            },
        ])
        .unwrap();

        assert_eq!(fs::read(a_path).unwrap(), b"beta");
        assert_eq!(fs::read(b_path).unwrap(), b"alpha");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn batch_rename_rejects_existing_target_outside_batch() {
        let tmp = create_test_dir("batch_conflict");
        fs::create_dir_all(&tmp).unwrap();

        let a_path = tmp.join("a.txt");
        let c_path = tmp.join("c.txt");
        fs::write(&a_path, b"alpha").unwrap();
        fs::write(&c_path, b"charlie").unwrap();

        let result = apply_batch_rename_operations(vec![BatchRenameOperation {
            old_path: a_path.to_string_lossy().to_string(),
            new_path: c_path.to_string_lossy().to_string(),
        }]);

        assert!(result.is_err());

        let _ = fs::remove_dir_all(&tmp);
    }
}
