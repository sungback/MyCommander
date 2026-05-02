use super::copy::copy_path_to_destination;
use super::path_utils::{normalize_target_path, remove_path};
use crate::commands::fs::shared::{is_operation_cancelled, ProgressPayload};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Emitter;

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
    let multiple_sources = source_paths.len() > 1;

    for (index, path) in source_paths.iter().enumerate() {
        if is_operation_cancelled(cancel_flag.as_deref()) {
            return Err("Operation cancelled.".to_string());
        }
        let src = Path::new(path);
        let file_name = src
            .file_name()
            .ok_or_else(|| format!("Could not determine file name for {}", src.display()))?;
        let file_name_str = file_name.to_string_lossy().to_string();
        let dest = resolve_move_destination(src, &target_dir, multiple_sources)?;

        ensure_move_destination_valid(src, &dest, &file_name_str)?;

        move_path_to_destination(src, &dest, cancel_flag.as_deref())?;
        emit_progress(ProgressPayload {
            operation: "move".to_string(),
            current: (index + 1) as u64,
            total,
            current_file: file_name_str,
            unit: "items".to_string(),
        });
    }
    Ok(())
}

fn move_path_to_destination(
    source: &Path,
    destination: &Path,
    cancel_flag: Option<&AtomicBool>,
) -> Result<(), String> {
    move_path_to_destination_with_rename(
        source,
        destination,
        |source, destination| fs::rename(source, destination),
        cancel_flag,
    )
}

pub(crate) fn move_path_to_destination_with_rename<F>(
    source: &Path,
    destination: &Path,
    rename: F,
    cancel_flag: Option<&AtomicBool>,
) -> Result<(), String>
where
    F: Fn(&Path, &Path) -> std::io::Result<()>,
{
    match rename(source, destination) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::CrossesDevices => {
            move_path_across_filesystems(source, destination, cancel_flag)
        }
        Err(error) => Err(error.to_string()),
    }
}

fn move_path_across_filesystems(
    source: &Path,
    destination: &Path,
    cancel_flag: Option<&AtomicBool>,
) -> Result<(), String> {
    let source_link_metadata = fs::symlink_metadata(source).map_err(|e| e.to_string())?;
    if source_link_metadata.file_type().is_symlink() {
        return Err(format!(
            "Cross-volume move of symbolic links is not supported: {}",
            source.display()
        ));
    }

    let temporary_destination = get_temporary_move_path(destination)?;
    if let Err(error) = copy_path_to_destination(source, &temporary_destination, false, cancel_flag)
    {
        let _ = remove_path(&temporary_destination);
        return Err(error);
    }

    if destination.exists() {
        let _ = remove_path(&temporary_destination);
        return Err(format!(
            "Target path already exists: {}",
            destination.display()
        ));
    }

    if let Err(error) = fs::rename(&temporary_destination, destination) {
        let _ = remove_path(&temporary_destination);
        return Err(error.to_string());
    }

    remove_path(source)
}

fn resolve_move_destination(
    source: &Path,
    target_path: &str,
    multiple_sources: bool,
) -> Result<PathBuf, String> {
    let target = Path::new(target_path);

    if target.exists() && target.is_dir() {
        let file_name = source
            .file_name()
            .ok_or_else(|| format!("Could not determine file name for {}", source.display()))?;
        return Ok(target.join(file_name));
    }

    if multiple_sources {
        return Err(format!(
            "Move target must be an existing folder when moving multiple items: {}",
            target.display()
        ));
    }

    let parent = target.parent().ok_or_else(|| {
        format!(
            "Could not determine target parent directory for {}",
            target.display()
        )
    })?;
    if !parent.exists() {
        return Err(format!(
            "Target parent directory does not exist: {}",
            parent.display()
        ));
    }

    Ok(target.to_path_buf())
}

fn ensure_move_destination_valid(
    source: &Path,
    destination: &Path,
    file_name_str: &str,
) -> Result<(), String> {
    if source == destination {
        return Err(format!("이미 같은 위치에 있습니다: {file_name_str}"));
    }

    let source_canonical = source.canonicalize().map_err(|e| e.to_string())?;
    if destination.exists() {
        let destination_canonical = destination.canonicalize().map_err(|e| e.to_string())?;
        if source_canonical == destination_canonical {
            return Err(format!("이미 같은 위치에 있습니다: {file_name_str}"));
        }

        return Err(format!(
            "Target path already exists: {}",
            destination.display()
        ));
    }

    if source.is_dir() {
        let normalized_destination = normalize_target_path(destination)?;
        if normalized_destination.starts_with(&source_canonical) {
            return Err(format!(
                "Cannot move a directory into itself: {}",
                source.display()
            ));
        }
    }

    Ok(())
}

fn get_temporary_move_path(destination: &Path) -> Result<PathBuf, String> {
    let parent = destination.parent().ok_or_else(|| {
        format!(
            "Could not find parent directory for {}",
            destination.display()
        )
    })?;
    let file_name = destination
        .file_name()
        .ok_or_else(|| {
            format!(
                "Could not determine file name for {}",
                destination.display()
            )
        })?
        .to_string_lossy();
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();

    for attempt in 0..1000usize {
        let candidate = parent.join(format!(".__mycommander_move_{seed}_{attempt}_{file_name}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Could not create a temporary move path for {}",
        destination.display()
    ))
}
