use super::path_utils::{normalize_target_path, remove_path};
use crate::commands::fs::shared::{is_operation_cancelled, ProgressPayload};
use std::fs::{self, OpenOptions};
use std::io::{self, ErrorKind};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Emitter;

#[path = "copy_conflicts.rs"]
mod copy_conflicts;
#[path = "copy_naming.rs"]
mod copy_naming;
#[path = "copy_progress.rs"]
mod copy_progress;

pub(crate) use copy_conflicts::collect_copy_conflicts;
use copy_naming::make_copy_name;
use copy_progress::{emit_copy_progress, file_name_for_progress};

#[tauri::command(rename_all = "snake_case")]
pub async fn copy_files(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_path: String,
    keep_both: Option<bool>,
    overwrite: Option<bool>,
) -> Result<Vec<String>, String> {
    copy_files_with_cancel_and_progress(
        source_paths,
        target_path,
        keep_both,
        overwrite,
        None,
        move |payload| {
            let _ = app.emit("fs-progress", payload);
        },
    )
    .await
}

pub async fn copy_files_with_cancel_and_progress<F>(
    source_paths: Vec<String>,
    target_path: String,
    keep_both: Option<bool>,
    overwrite: Option<bool>,
    cancel_flag: Option<Arc<AtomicBool>>,
    emit_progress: F,
) -> Result<Vec<String>, String>
where
    F: Fn(ProgressPayload) + Send + 'static,
{
    let keep_both = keep_both.unwrap_or(false);
    let overwrite = overwrite.unwrap_or(false);
    let total = source_paths.len() as u64;
    tokio::task::spawn_blocking(move || {
        if source_paths.is_empty() {
            return Ok(vec![]);
        }

        if is_operation_cancelled(cancel_flag.as_deref()) {
            return Err("Operation cancelled.".to_string());
        }

        if source_paths.len() == 1 {
            let file_name = file_name_for_progress(&source_paths[0]);
            let saved = copy_single_path(
                Path::new(&source_paths[0]),
                &target_path,
                keep_both,
                overwrite,
                cancel_flag.as_deref(),
            )?;
            emit_copy_progress(&emit_progress, 1, total, file_name);
            return Ok(vec![saved]);
        }

        let target_root = Path::new(&target_path);
        fs::create_dir_all(target_root).map_err(|e| e.to_string())?;
        if !target_root.is_dir() {
            return Err(format!("{target_path} is not a directory"));
        }

        let mut saved_names = Vec::with_capacity(source_paths.len());
        for (index, source) in source_paths.iter().enumerate() {
            if is_operation_cancelled(cancel_flag.as_deref()) {
                return Err("Operation cancelled.".to_string());
            }
            let file_name = file_name_for_progress(source);
            let saved = copy_path_into_dir(
                Path::new(source),
                target_root,
                keep_both,
                overwrite,
                cancel_flag.as_deref(),
            )?;
            saved_names.push(saved);
            emit_copy_progress(&emit_progress, (index + 1) as u64, total, file_name);
        }
        Ok(saved_names)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn copy_single_path(
    source: &Path,
    target_path: &str,
    keep_both: bool,
    overwrite: bool,
    cancel_flag: Option<&AtomicBool>,
) -> Result<String, String> {
    let target = Path::new(target_path);

    if target.exists() && target.is_dir() {
        return copy_path_into_dir(source, target, keep_both, overwrite, cancel_flag);
    }

    if target_path.ends_with(std::path::MAIN_SEPARATOR)
        || target_path.ends_with('/')
        || target_path.ends_with('\\')
    {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
        return copy_path_into_dir(source, target, keep_both, overwrite, cancel_flag);
    }

    copy_path_to_destination(source, target, overwrite, cancel_flag)?;
    Ok(target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default())
}

fn copy_path_into_dir(
    source: &Path,
    target_dir: &Path,
    keep_both: bool,
    overwrite: bool,
    cancel_flag: Option<&AtomicBool>,
) -> Result<String, String> {
    let file_name = source
        .file_name()
        .ok_or_else(|| format!("Could not determine file name for {}", source.display()))?;

    let same_folder = source.parent().map(|p| p == target_dir).unwrap_or(false);

    let destination = if same_folder || (keep_both && target_dir.join(file_name).exists()) {
        make_copy_name(source, target_dir)
    } else {
        target_dir.join(file_name)
    };

    let saved_name = destination
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    copy_path_to_destination(source, &destination, overwrite, cancel_flag)?;
    Ok(saved_name)
}

pub(crate) fn copy_path_to_destination(
    source: &Path,
    destination: &Path,
    overwrite: bool,
    cancel_flag: Option<&AtomicBool>,
) -> Result<(), String> {
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

        if !overwrite {
            return Err(format!(
                "Target path already exists: {}",
                destination.display()
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

        if let Err(error) = copy_directory_recursive(source, destination, overwrite, cancel_flag) {
            if !overwrite {
                let _ = remove_path(destination);
            }
            return Err(error);
        }
        return Ok(());
    }

    copy_file_to_destination(source, destination, overwrite, cancel_flag)
}

fn copy_directory_recursive(
    source: &Path,
    destination: &Path,
    overwrite: bool,
    cancel_flag: Option<&AtomicBool>,
) -> Result<(), String> {
    use walkdir::WalkDir;

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if overwrite {
        fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    } else {
        fs::create_dir(destination).map_err(|error| {
            if error.kind() == ErrorKind::AlreadyExists {
                format!("Target path already exists: {}", destination.display())
            } else {
                error.to_string()
            }
        })?;
    }

    for entry in WalkDir::new(source) {
        if is_operation_cancelled(cancel_flag) {
            return Err("Operation cancelled.".to_string());
        }

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

        copy_file_to_destination(entry_path, &destination_path, overwrite, cancel_flag)?;
    }

    Ok(())
}

fn copy_file_to_destination(
    source: &Path,
    destination: &Path,
    overwrite: bool,
    cancel_flag: Option<&AtomicBool>,
) -> Result<(), String> {
    if is_operation_cancelled(cancel_flag) {
        return Err("Operation cancelled.".to_string());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    if overwrite {
        fs::copy(source, destination).map_err(|e| e.to_string())?;
        return Ok(());
    }

    copy_file_without_overwrite(source, destination)?;
    Ok(())
}

fn copy_file_without_overwrite(source: &Path, destination: &Path) -> Result<(), String> {
    let mut source_file = fs::File::open(source).map_err(|e| e.to_string())?;
    let mut destination_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .map_err(|error| {
            if error.kind() == ErrorKind::AlreadyExists {
                format!("Target path already exists: {}", destination.display())
            } else {
                error.to_string()
            }
        })?;

    if let Err(error) = io::copy(&mut source_file, &mut destination_file) {
        let _ = fs::remove_file(destination);
        return Err(error.to_string());
    }

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn check_copy_conflicts(
    source_paths: Vec<String>,
    target_path: String,
) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || collect_copy_conflicts(&source_paths, &target_path))
        .await
        .map_err(|e| e.to_string())?
}
