use crate::commands::fs::shared::{
    is_operation_cancelled, validate_fs_path, validate_fs_paths, ProgressPayload,
};
use std::fs;
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
#[path = "copy_transfer.rs"]
mod copy_transfer;

pub(crate) use copy_conflicts::collect_copy_conflicts;
use copy_naming::make_copy_name;
use copy_progress::{emit_copy_progress, file_name_for_progress};
pub(crate) use copy_transfer::copy_path_to_destination;

#[tauri::command(rename_all = "snake_case")]
pub async fn copy_files(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_path: String,
    keep_both: Option<bool>,
    overwrite: Option<bool>,
) -> Result<Vec<String>, String> {
    validate_fs_paths(&source_paths)?;
    validate_fs_path(&target_path)?;
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

#[tauri::command(rename_all = "snake_case")]
pub async fn check_copy_conflicts(
    source_paths: Vec<String>,
    target_path: String,
) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || collect_copy_conflicts(&source_paths, &target_path))
        .await
        .map_err(|e| e.to_string())?
}
