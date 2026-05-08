mod parse;
mod runner;
mod status;
mod types;

pub use types::GitStatus;

#[cfg(test)]
mod tests;

#[tauri::command(rename_all = "snake_case")]
pub async fn get_git_status(path: String) -> Result<Option<GitStatus>, String> {
    tokio::task::spawn_blocking(move || status::get_git_status_for_path(&path))
        .await
        .map_err(|error| error.to_string())?
}
