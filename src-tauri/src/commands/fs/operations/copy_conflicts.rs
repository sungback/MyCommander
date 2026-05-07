use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub(crate) fn collect_copy_conflicts(
    source_paths: &[String],
    target_path: &str,
) -> Result<Vec<String>, String> {
    let target = Path::new(target_path);
    let multiple_sources = source_paths.len() > 1;
    let mut seen_destinations = HashSet::new();
    let mut seen_conflict_names = HashSet::new();
    let mut conflicts = Vec::new();

    for source in source_paths {
        let src = Path::new(source);
        let file_name = src
            .file_name()
            .ok_or_else(|| format!("Invalid path: {source}"))?;
        let destination =
            resolve_copy_conflict_destination(target, target_path, file_name, multiple_sources);
        if destination.exists() || !seen_destinations.insert(destination) {
            let conflict_name = file_name.to_string_lossy().to_string();
            if seen_conflict_names.insert(conflict_name.clone()) {
                conflicts.push(conflict_name);
            }
        }
    }

    Ok(conflicts)
}

fn resolve_copy_conflict_destination(
    target: &Path,
    target_path: &str,
    file_name: &std::ffi::OsStr,
    multiple_sources: bool,
) -> PathBuf {
    if multiple_sources
        || target.is_dir()
        || target_path.ends_with(std::path::MAIN_SEPARATOR)
        || target_path.ends_with('/')
        || target_path.ends_with('\\')
    {
        target.join(file_name)
    } else {
        target.to_path_buf()
    }
}
