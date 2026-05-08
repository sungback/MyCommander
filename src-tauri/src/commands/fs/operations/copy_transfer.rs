use super::super::path_utils::{normalize_target_path, remove_path};
use crate::commands::fs::shared::is_operation_cancelled;
use std::fs::{self, OpenOptions};
use std::io::{self, ErrorKind};
use std::path::Path;
use std::sync::atomic::AtomicBool;

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
