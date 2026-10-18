use super::terminal::working_directory_for_path;
use std::path::Path;
use std::process::Command;

pub(super) fn run_shell_command_for_path(path: &Path, command: &str) -> Result<(), String> {
    let working_directory = working_directory_for_path(path)?;

    if command.trim().is_empty() {
        return Err("Command is empty".to_string());
    }

    if command.contains(['\n', '\r', '\0']) {
        return Err("Command must not contain control characters".to_string());
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
        use std::os::windows::process::CommandExt;

        const CREATE_NEW_CONSOLE: u32 = 0x00000010;
        // 작업 폴더는 `cd /d "..."` 대신 current_dir로 넘긴다. Rust는 인자 안의 따옴표를 `\"`로
        // 바꾸는데 cmd는 이를 이해하지 못해 경로 앞에 `\`가 붙었다. 명령은 raw_arg로 입력 그대로 넘긴다.
        Command::new("cmd.exe")
            .args(["/S", "/K"])
            .raw_arg(cmd_keep_open_argument(command))
            .current_dir(&working_directory)
            .creation_flags(CREATE_NEW_CONSOLE)
            .spawn()
            .map(|_| ())
            .map_err(|error| error.to_string())?;
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

/// `cmd /S /K "..."`는 바깥 따옴표 한 쌍만 떼고 안쪽을 입력 그대로 실행한다.
#[cfg(any(target_os = "windows", test))]
fn cmd_keep_open_argument(command: &str) -> String {
    format!("\"{command}\"")
}

#[cfg(test)]
mod tests {
    use super::cmd_keep_open_argument;

    #[test]
    fn cmd_keep_open_argument_wraps_command_without_escaping() {
        assert_eq!(cmd_keep_open_argument("code ."), r#""code .""#);
        assert_eq!(
            cmd_keep_open_argument(r#"code "my file.txt" && dir"#),
            r#""code "my file.txt" && dir""#
        );
    }
}
