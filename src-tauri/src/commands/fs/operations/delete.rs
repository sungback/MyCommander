use crate::commands::fs::shared::{is_operation_cancelled, validate_fs_paths, ProgressPayload};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Emitter;

#[cfg(target_os = "macos")]
use trash::macos::{DeleteMethod, TrashContextExtMacos};

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_files(
    app: tauri::AppHandle,
    paths: Vec<String>,
    permanent: bool,
    confirmed_path_count: Option<usize>,
) -> Result<(), String> {
    validate_fs_paths(&paths)?;
    if permanent {
        match confirmed_path_count {
            Some(count) if count == paths.len() => {}
            _ => {
                return Err(format!(
                    "Permanent deletion requires confirmed_path_count={}, got {:?}",
                    paths.len(),
                    confirmed_path_count
                ))
            }
        }
    }
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

    tokio::task::spawn_blocking(move || {
        delete_files_blocking(targets, permanent, cancel_flag, emit_progress)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(crate) fn collapse_nested_paths(paths: Vec<String>) -> Vec<PathBuf> {
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

pub(crate) fn collect_delete_progress_targets(paths: Vec<String>) -> Vec<PathBuf> {
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
            move_to_trash(path)?;
        }

        emit_delete_progress(&emit_progress, index as u64 + 1, total, &current_file);
    }

    Ok(())
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

fn move_to_trash(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        move_to_trash_with_methods(path, |path, method| {
            let mut ctx = trash::TrashContext::new();
            ctx.set_delete_method(method);
            ctx.delete(path).map_err(|error| error.to_string())
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        trash::delete(path).map_err(|error| error.to_string())
    }
}

/// Retry native trash failures through Finder without ever falling back to permanent deletion.
#[cfg(target_os = "macos")]
fn move_to_trash_with_methods<F>(path: &Path, mut delete: F) -> Result<(), String>
where
    F: FnMut(&Path, DeleteMethod) -> Result<(), String>,
{
    let native_error = match delete(path, DeleteMethod::NsFileManager) {
        Ok(()) => return Ok(()),
        Err(error) => error,
    };

    // trash's Finder backend percent-encodes invalid UTF-8, which could address a
    // different file with a literal percent-encoded name. Do not retry such paths.
    if path.to_str().is_none() {
        return Err(native_error);
    }

    // Do not retry an item already moved by the native API. Use lstat so a symlink,
    // including a broken one, is retried as the selected entry rather than its target.
    if matches!(fs::symlink_metadata(path), Err(error) if error.kind() == std::io::ErrorKind::NotFound)
    {
        return Err(native_error);
    }

    delete(path, DeleteMethod::Finder).map_err(|finder_error| {
        format!(
            "Could not move '{}' to Trash. Native trash: {native_error}. Finder: {finder_error}. \
             Check MyCommander access in System Settings > Privacy & Security > Files and Folders \
             and Automation (Finder), and the item's permissions.",
            path.display()
        )
    })
}

#[cfg(all(test, target_os = "macos"))]
mod tests;
