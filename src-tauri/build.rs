fn main() {
    let app_manifest = tauri_build::AppManifest::new().commands(&[
        "get_drives",
        "get_home_dir",
        "get_available_space",
        "open_in_terminal",
        "open_in_editor",
        "open_file",
        "quit_app",
        "list_directory",
        "create_directory",
        "create_file",
        "delete_files",
        "rename_file",
        "copy_files",
        "move_files",
        "extract_zip",
        "read_file_content",
        "search_files",
        "get_dir_size",
    ]);

    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(app_manifest))
        .expect("failed to run tauri build script");
}
