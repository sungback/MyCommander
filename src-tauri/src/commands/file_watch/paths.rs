use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub(super) fn collect_watchable_paths(paths: Vec<String>) -> HashSet<PathBuf> {
    paths
        .into_iter()
        .filter_map(|raw_path| {
            let trimmed = raw_path.trim();
            if trimmed.is_empty() {
                return None;
            }

            let candidate = PathBuf::from(trimmed);
            if !candidate.is_absolute() || !candidate.is_dir() {
                return None;
            }

            Some(std::fs::canonicalize(&candidate).unwrap_or(candidate))
        })
        .collect()
}

pub(super) fn collect_changed_directories_and_paths(
    event_paths: &[PathBuf],
) -> (Vec<String>, Vec<String>) {
    let mut directory_set = HashSet::new();
    let mut path_set = HashSet::new();

    for path in event_paths {
        if let Some(path_text) = path_to_string(path) {
            path_set.insert(path_text.clone());
            directory_set.insert(path_text);
        }

        if let Some(parent) = path.parent().and_then(path_to_string) {
            directory_set.insert(parent);
        }
    }

    let mut directories: Vec<String> = directory_set.into_iter().collect();
    let mut paths: Vec<String> = path_set.into_iter().collect();
    directories.sort_unstable();
    paths.sort_unstable();

    (directories, paths)
}

fn path_to_string(path: &Path) -> Option<String> {
    if path.as_os_str().is_empty() {
        return None;
    }

    Some(path.to_string_lossy().to_string())
}
