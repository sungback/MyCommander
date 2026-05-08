use super::super::paths::resolve_existing_path;
use std::path::{Path, PathBuf};
use std::process::Command;

pub(super) fn open_in_terminal_for_path(path: &Path) -> Result<(), String> {
    let terminal_path = working_directory_for_path(path)?;

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

pub(super) fn working_directory_for_path(path: &Path) -> Result<PathBuf, String> {
    let resolved_path = resolve_existing_path(path)?;
    if resolved_path.is_dir() {
        return Ok(resolved_path);
    }

    resolved_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| format!("Could not find parent directory for {}", path.display()))
}
