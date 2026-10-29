use super::super::super::path_display::path_to_display_string;
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
    let directory = if resolved_path.is_dir() {
        resolved_path
    } else {
        resolved_path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| format!("Could not find parent directory for {}", path.display()))?
    };

    // Windows canonicalize는 `\\?\C:\...` 형식을 돌려주는데, CMD는 이 경로로 `cd`하지 못한다.
    Ok(PathBuf::from(path_to_display_string(&directory)))
}

#[cfg(test)]
mod tests {
    use super::working_directory_for_path;

    #[test]
    fn working_directory_has_no_windows_extended_prefix() {
        let directory =
            std::env::temp_dir().join(format!("mycommander_terminal_{}", std::process::id()));
        std::fs::create_dir_all(&directory).expect("create temp dir");
        let file_path = directory.join("note.txt");
        std::fs::write(&file_path, "x").expect("write file");

        for path in [directory.as_path(), file_path.as_path()] {
            let working_directory = working_directory_for_path(path).expect("working directory");
            assert!(!working_directory.to_string_lossy().starts_with(r"\\?\"));
            assert_eq!(
                working_directory.canonicalize().expect("canonicalize"),
                directory.canonicalize().expect("canonicalize")
            );
        }

        std::fs::remove_dir_all(&directory).expect("remove temp dir");
    }
}
