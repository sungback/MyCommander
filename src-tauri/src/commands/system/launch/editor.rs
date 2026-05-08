use super::super::paths::resolve_existing_path;
use std::path::Path;
use std::process::Command;

pub(super) fn open_in_editor_for_path(path: &Path) -> Result<(), String> {
    let resolved_path = resolve_existing_path(path)?;

    if resolved_path.is_dir() {
        return Err("Cannot edit a directory.".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "TextEdit"])
            .arg(&resolved_path)
            .status()
            .map_err(|error| error.to_string())
            .and_then(|status| {
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("TextEdit exited with status {status}"))
                }
            })?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("notepad")
            .arg(&resolved_path)
            .spawn()
            .map(|_| ())
            .map_err(|error| error.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&resolved_path)
            .status()
            .map_err(|error| error.to_string())
            .and_then(|status| {
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("Editor exited with status {status}"))
                }
            })?;
    }

    Ok(())
}
