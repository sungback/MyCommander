use std::path::Path;
use std::process::Command;

pub(super) fn open_file_with_default_app(path: &Path) -> Result<(), String> {
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
