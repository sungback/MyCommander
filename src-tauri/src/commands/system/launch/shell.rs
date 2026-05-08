use super::terminal::working_directory_for_path;
use std::path::Path;
use std::process::Command;

pub(super) fn run_shell_command_for_path(path: &Path, command: &str) -> Result<(), String> {
    let working_directory = working_directory_for_path(path)?;

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
