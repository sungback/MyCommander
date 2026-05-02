mod app_menu;
mod app_menu_events;
mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::file_watch_commands::FileWatcherState::default())
        .menu(app_menu::build_app_menu)
        .on_menu_event(|app, event| app_menu_events::handle_menu_event(app, event.id().as_ref()))
        .manage(commands::jobs::JobEngineState::default())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            use tauri_plugin_window_state::{StateFlags, WindowExt};
            if let Some(window) = app.get_webview_window("main") {
                let flags = StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED;
                let _ = window.restore_state(flags);
            }
            Ok(())
        })
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::system::drives::get_drives,
            commands::system::paths::get_home_dir,
            commands::system::paths::resolve_path,
            commands::system::paths::get_available_space,
            commands::system::launch::open_in_terminal,
            commands::system::launch::open_in_editor,
            commands::system::launch::open_file,
            commands::system::launch::run_shell_command,
            commands::system::menu::quit_app,
            commands::system::menu::show_context_menu,
            commands::system::menu::set_show_hidden_menu_checked,
            commands::system::menu::set_theme_menu_selection,
            commands::system::menu::set_view_mode_menu_selection,
            commands::fs::metadata::list_directory,
            commands::fs::operations::create_directory,
            commands::fs::operations::rename::create_file,
            commands::fs::operations::delete::delete_files,
            commands::fs::operations::rename::rename_file,
            commands::fs::operations::rename::apply_batch_rename,
            commands::fs::operations::copy::copy_files,
            commands::fs::operations::move_ops::move_files,
            commands::fs::operations::copy::check_copy_conflicts,
            commands::fs::archive::extract_zip,
            commands::fs::archive::create_zip,
            commands::fs::archive::create_zip_from_paths,
            commands::fs::archive::cancel_zip_operation,
            commands::jobs::commands::submit_job,
            commands::jobs::commands::list_jobs,
            commands::jobs::commands::cancel_job,
            commands::jobs::commands::retry_job,
            commands::jobs::commands::clear_finished_jobs,
            commands::fs::metadata::read_file_content,
            commands::search_commands::search_files,
            commands::fs::metadata::get_dir_size,
            commands::drag_commands::write_files_to_pasteboard,
            commands::git_commands::get_git_status,
            commands::sync_commands::compare_directories,
            commands::file_watch_commands::sync_watched_directories,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
