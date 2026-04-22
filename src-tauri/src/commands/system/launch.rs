use super::paths::resolve_existing_path;
use std::path::{Path, PathBuf};
use std::process::Command;

#[tauri::command(rename_all = "snake_case")]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || open_in_terminal_for_path(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn open_in_editor(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || open_in_editor_for_path(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn open_file(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || open_file_with_default_app(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn run_shell_command(path: String, command: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || run_shell_command_for_path(&path, &command))
        .await
        .map_err(|error| error.to_string())?
}

fn open_file_with_default_app(path: &Path) -> Result<(), String> {
    let resolved_path = if path.exists() {
        path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
    } else {
        return Err(format!("{} does not exist", path.display()));
    };

    #[cfg(target_os = "macos")]
    {
        let is_dmg = resolved_path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("dmg"));

        let output = if is_dmg {
            Command::new("hdiutil")
                .args(["attach", "-autoopen"])
                .arg(&resolved_path)
                .output()
                .map_err(|error| error.to_string())?
        } else {
            Command::new("open")
                .arg(&resolved_path)
                .output()
                .map_err(|error| error.to_string())?
        };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let detail = if !stderr.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else if is_dmg {
                format!("Failed to mount disk image {}", resolved_path.display())
            } else {
                format!("Failed to open {}", resolved_path.display())
            };

            return Err(detail);
        }
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(&resolved_path)
            .status()
            .map_err(|error| error.to_string())
            .and_then(|status| {
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("Failed to open {}", resolved_path.display()))
                }
            })?;
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
                    Err(format!("Failed to open {}", resolved_path.display()))
                }
            })?;
    }

    Ok(())
}

fn open_in_terminal_for_path(path: &Path) -> Result<(), String> {
    let resolved_path = resolve_existing_path(path)?;
    let terminal_path = if resolved_path.is_dir() {
        resolved_path
    } else {
        resolved_path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| format!("Could not find parent directory for {}", path.display()))?
    };

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "Terminal"])
            .arg(&terminal_path)
            .status()
            .map_err(|error| error.to_string())
            .and_then(|status| {
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("Terminal exited with status {status}"))
                }
            })?;
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("cmd")
            .args(["/C", "start", "", "wt.exe", "-d"])
            .arg(&terminal_path)
            .status();

        match status {
            Ok(status) if status.success() => {}
            _ => {
                Command::new("cmd")
                    .args(["/C", "start", "", "cmd.exe", "/K", "cd", "/d"])
                    .arg(&terminal_path)
                    .status()
                    .map_err(|error| error.to_string())
                    .and_then(|status| {
                        if status.success() {
                            Ok(())
                        } else {
                            Err(format!("Terminal exited with status {status}"))
                        }
                    })?;
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let terminal_commands: [(&str, &[&str]); 3] = [
            ("x-terminal-emulator", &["--working-directory"]),
            ("gnome-terminal", &["--working-directory"]),
            ("konsole", &["--workdir"]),
        ];

        let mut opened = false;
        for (program, args) in terminal_commands {
            if let Ok(status) = Command::new(program)
                .args(args)
                .arg(&terminal_path)
                .status()
            {
                if status.success() {
                    opened = true;
                    break;
                }
            }
        }

        if !opened {
            return Err("Could not launch a terminal application".to_string());
        }
    }

    Ok(())
}

fn run_shell_command_for_path(path: &Path, command: &str) -> Result<(), String> {
    let resolved_path = resolve_existing_path(path)?;
    let working_directory = if resolved_path.is_dir() {
        resolved_path
    } else {
        resolved_path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| format!("Could not find parent directory for {}", path.display()))?
    };

    if command.trim().is_empty() {
        return Err("Command is empty".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let shell_path = shell_escape_single_quotes(&working_directory.to_string_lossy());
        let shell_command = format!("cd '{}' ; {}", shell_path, command);
        let script = format!(
            "tell application \"Terminal\"\nactivate\ndo script \"{}\"\nend tell",
            escape_applescript_string(&shell_command)
        );

        Command::new("osascript")
            .args(["-e", &script])
            .status()
            .map_err(|error| error.to_string())
            .and_then(|status| {
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("Terminal exited with status {status}"))
                }
            })?;
    }

    #[cfg(target_os = "windows")]
    {
        let cwd = working_directory.to_string_lossy().replace('"', "\"\"");
        let cmdline = format!("cd /d \"{}\" && {}", cwd, command);

        Command::new("cmd")
            .args(["/C", "start", "", "cmd.exe", "/K", &cmdline])
            .status()
            .map_err(|error| error.to_string())
            .and_then(|status| {
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("Command Prompt exited with status {status}"))
                }
            })?;
    }

    #[cfg(target_os = "linux")]
    {
        let shell_path = shell_escape_single_quotes(&working_directory.to_string_lossy());
        let shell_command = format!("cd '{}' ; {} ; exec \"$SHELL\" -l", shell_path, command);
        let terminal_commands: [(&str, &[&str]); 3] = [
            ("x-terminal-emulator", &["-e", "sh", "-lc"]),
            ("gnome-terminal", &["--", "sh", "-lc"]),
            ("konsole", &["-e", "sh", "-lc"]),
        ];

        let mut opened = false;
        for (program, args) in terminal_commands {
            if let Ok(status) = Command::new(program)
                .args(args)
                .arg(&shell_command)
                .status()
            {
                if status.success() {
                    opened = true;
                    break;
                }
            }
        }

        if !opened {
            return Err("Could not open a terminal application".to_string());
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn shell_escape_single_quotes(value: &str) -> String {
    value.replace('\'', "'\\''")
}

#[cfg(target_os = "macos")]
fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn open_in_editor_for_path(path: &Path) -> Result<(), String> {
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
