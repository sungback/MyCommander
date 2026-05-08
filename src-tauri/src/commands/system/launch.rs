use std::path::PathBuf;

#[path = "launch/editor.rs"]
mod editor;
#[path = "launch/open.rs"]
mod open;
#[path = "launch/shell.rs"]
mod shell;
#[path = "launch/terminal.rs"]
mod terminal;

#[tauri::command(rename_all = "snake_case")]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || terminal::open_in_terminal_for_path(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn open_in_editor(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || editor::open_in_editor_for_path(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn open_file(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || open::open_file_with_default_app(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn run_shell_command(path: String, command: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || shell::run_shell_command_for_path(&path, &command))
        .await
        .map_err(|error| error.to_string())?
}
