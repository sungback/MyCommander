use super::paths::{
    get_hidden_temp_archive_path, get_unique_archive_path, get_unique_archive_path_named,
    validate_zip_source_directory,
};
use super::progress::{
    build_zip_canceled_message, build_zip_failure_details, emit_zip_progress,
    parse_zip_progress_entry,
};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

pub(super) fn create_zip_archive(
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

pub(super) fn create_zip_archive_from_paths(
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
