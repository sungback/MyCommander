use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;
use tokio::time::Duration;

#[path = "file_watch/filter.rs"]
mod filter;
#[path = "file_watch/paths.rs"]
mod paths;

use filter::should_ignore_noisy_metadata_event_path;
use paths::{collect_changed_directories_and_paths, collect_watchable_paths};

const DEBOUNCE_DURATION: Duration = Duration::from_millis(200);

#[derive(Default)]
pub struct FileWatcherState {
    inner: Mutex<FileWatcherManager>,
}

#[derive(Default)]
struct FileWatcherManager {
    watcher: Option<RecommendedWatcher>,
    watched_paths: HashSet<PathBuf>,
    _event_tx: Option<mpsc::UnboundedSender<Event>>,
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
        let (watcher, tx) = build_watcher(app)?;
        manager.watcher = Some(watcher);
        manager._event_tx = Some(tx);
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

fn build_watcher(
    app: AppHandle,
) -> Result<(RecommendedWatcher, mpsc::UnboundedSender<Event>), String> {
    let (tx, rx) = mpsc::unbounded_channel::<Event>();

    tauri::async_runtime::spawn(run_debounce_task(app, rx));

    let tx_clone = tx.clone();
    let watcher = notify::recommended_watcher(move |event: notify::Result<Event>| match event {
        Ok(event) if !matches!(event.kind, EventKind::Access(_)) => {
            let _ = tx_clone.send(event);
        }
        Err(error) => eprintln!("file watcher error: {error}"),
        _ => {}
    })
    .map_err(|error| error.to_string())?;

    Ok((watcher, tx))
}

async fn run_debounce_task(app: AppHandle, mut rx: mpsc::UnboundedReceiver<Event>) {
    let mut pending: Vec<Event> = Vec::new();

    loop {
        match rx.recv().await {
            None => break,
            Some(event) => pending.push(event),
        }

        loop {
            match tokio::time::timeout(DEBOUNCE_DURATION, rx.recv()).await {
                Ok(Some(event)) => pending.push(event),
                Ok(None) => {
                    emit_batched_events(&app, std::mem::take(&mut pending));
                    return;
                }
                Err(_) => break,
            }
        }

        emit_batched_events(&app, std::mem::take(&mut pending));
    }
}

fn emit_batched_events(app: &AppHandle, events: Vec<Event>) {
    let filtered_paths: Vec<PathBuf> = events
        .into_iter()
        .flat_map(|e| {
            let kind = e.kind;
            e.paths.into_iter().map(move |p| (p, kind))
        })
        .filter(|(path, kind)| !should_ignore_noisy_metadata_event_path(path, kind))
        .map(|(path, _)| path)
        .collect();

    let (directories, paths) = collect_changed_directories_and_paths(&filtered_paths);
    if directories.is_empty() && paths.is_empty() {
        return;
    }

    let payload = FileSystemChangedPayload { directories, paths };
    let _ = app.emit("filesystem-changed", payload);
}

#[cfg(test)]
mod tests {
    use super::{
        filter::should_ignore_noisy_metadata_event_path,
        paths::{collect_changed_directories_and_paths, collect_watchable_paths},
    };
    use notify::event::{CreateKind, DataChange, ModifyKind, RemoveKind};
    use notify::EventKind;
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

    #[test]
    fn noisy_metadata_filter_ignores_git_internal_changes() {
        let internal_file = PathBuf::from("/tmp/mycommander/.git/index.lock");
        let internal_dir = PathBuf::from("/tmp/mycommander/.git/objects");
        let git_dir = PathBuf::from("/tmp/mycommander/.git");
        let gitignore = PathBuf::from("/tmp/mycommander/.gitignore");
        let modify = EventKind::Modify(ModifyKind::Data(DataChange::Any));

        assert!(should_ignore_noisy_metadata_event_path(
            &internal_file,
            &modify
        ));
        assert!(should_ignore_noisy_metadata_event_path(
            &internal_dir,
            &modify
        ));
        assert!(should_ignore_noisy_metadata_event_path(&git_dir, &modify));
        assert!(!should_ignore_noisy_metadata_event_path(
            &gitignore, &modify
        ));
    }

    #[test]
    fn noisy_metadata_filter_keeps_git_directory_lifecycle_changes() {
        let git_dir = PathBuf::from("/tmp/mycommander/.git");

        assert!(!should_ignore_noisy_metadata_event_path(
            &git_dir,
            &EventKind::Create(CreateKind::Folder)
        ));
        assert!(!should_ignore_noisy_metadata_event_path(
            &git_dir,
            &EventKind::Remove(RemoveKind::Folder)
        ));
    }

    #[test]
    fn noisy_metadata_filter_ignores_windows_app_data_descendants() {
        let app_data = PathBuf::from(r"C:\Users\sam\AppData");
        let app_data_child = PathBuf::from(r"C:\Users\sam\AppData\Local\Temp\cache.bin");
        let app_data_child_with_slashes = PathBuf::from(r"C:/Users/sam/AppData/Local/cache.bin");
        let unix_app_data_child = PathBuf::from("/Users/sam/AppData/Local/cache.bin");
        let similarly_named_dir = PathBuf::from(r"C:\Users\sam\AppDataBackup\cache.bin");
        let modify = EventKind::Modify(ModifyKind::Data(DataChange::Any));

        assert!(!should_ignore_noisy_metadata_event_path(&app_data, &modify));
        assert!(should_ignore_noisy_metadata_event_path(
            &app_data_child,
            &modify
        ));
        assert!(should_ignore_noisy_metadata_event_path(
            &app_data_child_with_slashes,
            &modify
        ));
        assert!(!should_ignore_noisy_metadata_event_path(
            &unix_app_data_child,
            &modify
        ));
        assert!(!should_ignore_noisy_metadata_event_path(
            &similarly_named_dir,
            &modify
        ));
    }
}
