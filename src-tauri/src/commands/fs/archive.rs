use super::shared::{describe_invalid_zip_problem, format_command_failure, ProgressPayload};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::Emitter;

static ZIP_OPERATION_STATE: OnceLock<Mutex<Option<Arc<AtomicBool>>>> = OnceLock::new();

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

pub(crate) fn flatten_matching_archive_root_dir(
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

pub(crate) fn validate_zip_source_directory(path: &str) -> Result<PathBuf, String> {
    let source_dir = PathBuf::from(path);
    if !source_dir.is_dir() {
        return Err(format!("{path} is not a directory"));
    }

    Ok(source_dir)
}

pub(crate) fn get_unique_extraction_dir(archive_path: &Path) -> Result<PathBuf, String> {
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

pub(crate) fn get_unique_archive_path(source_dir: &Path) -> Result<PathBuf, String> {
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
