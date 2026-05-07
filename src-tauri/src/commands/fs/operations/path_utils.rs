use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

pub(super) fn remove_path(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if metadata.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

pub(super) fn normalize_target_path(path: &Path) -> Result<PathBuf, String> {
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
