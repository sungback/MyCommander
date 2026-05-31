use super::{
    collect_changed_directories_and_paths, collect_watchable_paths,
    should_ignore_noisy_metadata_event_path,
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
