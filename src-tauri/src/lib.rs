mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::system_commands::get_drives,
            commands::system_commands::get_home_dir,
            commands::system_commands::get_available_space,
            commands::system_commands::open_in_terminal,
            commands::system_commands::open_in_editor,
            commands::system_commands::quit_app,
            commands::fs_commands::list_directory,
            commands::fs_commands::create_directory,
            commands::fs_commands::create_file,
            commands::fs_commands::delete_files,
            commands::fs_commands::rename_file,
            commands::fs_commands::copy_files,
            commands::fs_commands::move_files,
            commands::fs_commands::read_file_content,
            commands::search_commands::search_files,
            commands::fs_commands::get_dir_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
