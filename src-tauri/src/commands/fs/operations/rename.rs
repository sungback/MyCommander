use serde::Deserialize;
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) struct BatchRenameOperation {
    pub(crate) old_path: String,
    pub(crate) new_path: String,
}

#[derive(Clone)]
struct PreparedBatchRenameOperation {
    old_path: PathBuf,
    new_path: PathBuf,
    temp_path: PathBuf,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_file(path: String) -> Result<(), String> {
    create_new_file(Path::new(&path))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let old_path = PathBuf::from(old_path);
    let new_path = PathBuf::from(new_path);

    tokio::task::spawn_blocking(move || rename_file_without_overwrite(&old_path, &new_path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn apply_batch_rename(operations: Vec<BatchRenameOperation>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || apply_batch_rename_operations(operations))
        .await
        .map_err(|e| e.to_string())?
}

fn create_new_file(path: &Path) -> Result<(), String> {
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map(|_| ())
        .map_err(|error| {
            if error.kind() == ErrorKind::AlreadyExists {
                format!("Target path already exists: {}", path.display())
            } else {
                error.to_string()
            }
        })
}

fn rename_file_without_overwrite(old_path: &Path, new_path: &Path) -> Result<(), String> {
    fs::symlink_metadata(old_path).map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            format!("Source path does not exist: {}", old_path.display())
        } else {
            error.to_string()
        }
    })?;

    let target_is_same_entry = match fs::symlink_metadata(new_path) {
        Ok(_) => {
            if !paths_refer_to_same_entry(old_path, new_path) {
                return Err(format!(
                    "Target path already exists: {}",
                    new_path.display()
                ));
            }
            true
        }
        Err(error) if error.kind() == ErrorKind::NotFound => false,
        Err(error) => return Err(error.to_string()),
    };

    if old_path == new_path {
        return Ok(());
    }

    if target_is_same_entry {
        return rename_same_entry_through_temporary_path(old_path, new_path);
    }

    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

fn rename_same_entry_through_temporary_path(
    old_path: &Path,
    new_path: &Path,
) -> Result<(), String> {
    let temp_path = get_temporary_rename_path(old_path, 0)?;

    fs::rename(old_path, &temp_path).map_err(|e| e.to_string())?;
    fs::rename(&temp_path, new_path).map_err(|error| {
        let rollback_result = fs::rename(&temp_path, old_path);
        match rollback_result {
            Ok(()) => error.to_string(),
            Err(rollback_error) => {
                format!("{} (rollback failed: {})", error, rollback_error)
            }
        }
    })
}

fn paths_refer_to_same_entry(left: &Path, right: &Path) -> bool {
    left == right
        || left
            .canonicalize()
            .ok()
            .zip(right.canonicalize().ok())
            .is_some_and(|(left, right)| left == right)
}

pub(crate) fn apply_batch_rename_operations(
    operations: Vec<BatchRenameOperation>,
) -> Result<(), String> {
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

    for (i, operation) in prepared_operations.iter().enumerate() {
        if let Err(error) = fs::rename(&operation.old_path, &operation.temp_path) {
            rollback_temp_renames(&prepared_operations[..i]);
            return Err(error.to_string());
        }
    }

    for (i, operation) in prepared_operations.iter().enumerate() {
        if let Err(error) = fs::rename(&operation.temp_path, &operation.new_path) {
            rollback_target_renames(&prepared_operations[..i]);
            rollback_pending_temp_renames(&prepared_operations[i..]);
            return Err(error.to_string());
        }
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
