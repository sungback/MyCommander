use std::collections::HashSet;
use std::path::Path;

fn path_parent(path: &str) -> Option<String> {
    Path::new(path)
        .parent()
        .map(|parent| parent.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
}

fn unique_directories(paths: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut values = Vec::new();

    for path in paths {
        if seen.insert(path.clone()) {
            values.push(path);
        }
    }

    values
}

pub(crate) fn parent_directories(paths: &[String]) -> Vec<String> {
    unique_directories(paths.iter().filter_map(|path| path_parent(path)))
}

pub(crate) fn source_parent_and_target_directories(
    source_paths: &[String],
    target_dir: &str,
) -> Vec<String> {
    unique_directories(
        source_paths
            .iter()
            .filter_map(|path| path_parent(path))
            .chain(std::iter::once(target_dir.to_string())),
    )
}

pub(crate) fn zip_directory_affected_directories(
    source_path: &str,
    archive_path: &str,
) -> Vec<String> {
    unique_directories(
        path_parent(source_path)
            .into_iter()
            .chain(path_parent(archive_path)),
    )
}
