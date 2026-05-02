mod create;
mod extract;
mod paths;
mod progress;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use create::{create_zip_archive, create_zip_archive_from_paths};
use extract::extract_zip_archive;

#[cfg(test)]
pub(crate) use extract::flatten_matching_archive_root_dir;
#[cfg(test)]
pub(crate) use paths::{
    get_unique_archive_path, get_unique_extraction_dir, validate_zip_source_directory,
};

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
