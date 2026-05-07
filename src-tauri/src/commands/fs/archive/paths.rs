use std::path::{Path, PathBuf};

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

pub(super) fn get_unique_archive_path_named(
    target_dir: &Path,
    stem: &str,
) -> Result<PathBuf, String> {
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

pub(super) fn get_hidden_temp_archive_path(archive_path: &Path) -> Result<PathBuf, String> {
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
