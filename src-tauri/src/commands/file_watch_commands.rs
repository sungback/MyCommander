use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct FileWatcherState {
    inner: Mutex<FileWatcherManager>,
}

#[derive(Default)]
struct FileWatcherManager {
    watcher: Option<RecommendedWatcher>,
    watched_paths: HashSet<PathBuf>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSystemChangedPayload {
    directories: Vec<String>,
    paths: Vec<String>,
}

#[tauri::command(rename_all = "snake_case")]
pub fn sync_watched_directories(
    app: AppHandle,
    state: State<'_, FileWatcherState>,
    paths: Vec<String>,
) -> Result<(), String> {
    let desired_paths = collect_watchable_paths(paths);
    let mut manager = state
        .inner
        .lock()
        .map_err(|_| "Failed to lock file watcher state".to_string())?;

    if manager.watcher.is_none() {
        manager.watcher = Some(build_watcher(app)?);
    }

    let currently_watched = manager.watched_paths.clone();
    let paths_to_remove: Vec<PathBuf> = currently_watched
        .difference(&desired_paths)
        .cloned()
        .collect();
    let paths_to_add: Vec<PathBuf> = desired_paths
        .difference(&currently_watched)
        .cloned()
        .collect();

    let watcher = manager
        .watcher
        .as_mut()
        .ok_or_else(|| "File watcher is not initialized".to_string())?;

    for path in &paths_to_remove {
        watcher
            .unwatch(path)
            .map_err(|error| format!("Failed to stop watching {}: {error}", path.display()))?;
    }

    for path in &paths_to_add {
        watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|error| format!("Failed to watch {}: {error}", path.display()))?;
    }

    manager.watched_paths = desired_paths;
    Ok(())
}

fn build_watcher(app: AppHandle) -> Result<RecommendedWatcher, String> {
    notify::recommended_watcher(move |event: notify::Result<Event>| match event {
        Ok(event) => emit_filesystem_changed(&app, event),
        Err(error) => eprintln!("file watcher error: {error}"),
    })
    .map_err(|error| error.to_string())
}

fn emit_filesystem_changed(app: &AppHandle, event: Event) {
    if matches!(event.kind, EventKind::Access(_)) {
        return;
    }

    let (directories, paths) = collect_changed_directories_and_paths(&event.paths);
    if directories.is_empty() && paths.is_empty() {
        return;
    }

    let payload = FileSystemChangedPayload { directories, paths };
    let _ = app.emit("filesystem-changed", payload);
}

fn collect_watchable_paths(paths: Vec<String>) -> HashSet<PathBuf> {
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

fn collect_changed_directories_and_paths(event_paths: &[PathBuf]) -> (Vec<String>, Vec<String>) {
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

#[cfg(test)]
mod tests {
    use super::{collect_changed_directories_and_paths, collect_watchable_paths};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn collect_watchable_paths_keeps_absolute_directories_only() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("valid time")
            .as_nanos();
        let temp_root = std::env::temp_dir().join(format!("mycommander-watch-{unique}"));
        let nested_dir = temp_root.join("nested");
        let file_path = temp_root.join("file.txt");

        std::fs::create_dir_all(&nested_dir).expect("create nested dir");
        std::fs::write(&file_path, "content").expect("create file");

        let watch_paths = collect_watchable_paths(vec![
            nested_dir.to_string_lossy().to_string(),
            file_path.to_string_lossy().to_string(),
            "relative/path".to_string(),
        ]);

        assert_eq!(watch_paths.len(), 1);
        assert!(watch_paths.iter().any(|path| path.ends_with("nested")));

        let _ = std::fs::remove_file(file_path);
        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[test]
    fn collect_changed_directories_and_paths_includes_parent_directories() {
        let base = PathBuf::from("/tmp/mycommander");
        let changed_file = base.join("file.txt");

        let (directories, paths) =
            collect_changed_directories_and_paths(std::slice::from_ref(&changed_file));

        assert!(paths.contains(&changed_file.to_string_lossy().to_string()));
        assert!(directories.contains(&changed_file.to_string_lossy().to_string()));
        assert!(directories.contains(&base.to_string_lossy().to_string()));
    }
}
