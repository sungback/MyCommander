use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(not(target_os = "windows"))]
use sysinfo::Disks;

#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use windows::core::PCWSTR;
#[cfg(target_os = "windows")]
use windows::Win32::Storage::FileSystem::{GetDiskFreeSpaceExW, GetLogicalDrives};

#[derive(Serialize)]
pub struct DriveInfo {
    mount_point: String,
    name: String,
    drive_type: String, // "Fixed", "Removable", etc.
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_drives() -> Result<Vec<DriveInfo>, String> {
    let mut drives = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let mask = unsafe { GetLogicalDrives() };
        for i in 0..26 {
            if (mask & (1 << i)) != 0 {
                let letter = (b'A' + i as u8) as char;
                let path = format!("{}:\\", letter);
                drives.push(DriveInfo {
                    mount_point: path.clone(),
                    name: format!("Local Disk ({}:)", letter),
                    drive_type: "Fixed".to_string(), // Simplified for now
                });
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Add root /
        drives.push(DriveInfo {
            mount_point: "/".to_string(),
            name: "Macintosh HD".to_string(),
            drive_type: "Fixed".to_string(),
        });
        
        // Check /Volumes
        if let Ok(entries) = std::fs::read_dir("/Volumes") {
            for entry in entries.flatten() {
                if let Ok(file_name) = entry.file_name().into_string() {
                    let path = entry.path().to_string_lossy().to_string();
                    // Skip root alias usually found in /Volumes on older macOS
                    if file_name != "Macintosh HD" {
                        drives.push(DriveInfo {
                            mount_point: path,
                            name: file_name,
                            drive_type: "Removable".to_string(),
                        });
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        drives.push(DriveInfo {
            mount_point: "/".to_string(),
            name: "Root".to_string(),
            drive_type: "Fixed".to_string(),
        });
        // Logic to read /etc/mtab or /proc/mounts could be added
    }

    Ok(drives)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not find home directory".to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_available_space(path: String) -> Result<u64, String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || get_available_space_for_path(&path))
        .await
        .map_err(|e| e.to_string())?
}

fn get_available_space_for_path(path: &Path) -> Result<u64, String> {
    let resolved_path = resolve_existing_path(path)?;

    #[cfg(target_os = "windows")]
    {
        return get_available_space_for_windows_path(&resolved_path);
    }

    #[cfg(not(target_os = "windows"))]
    {
    let disks = Disks::new_with_refreshed_list();

        disks
            .list()
            .iter()
            .filter(|disk| resolved_path.starts_with(disk.mount_point()))
            .max_by_key(|disk| disk.mount_point().to_string_lossy().len())
            .map(|disk| disk.available_space())
            .ok_or_else(|| format!("Could not find a mounted volume for {}", resolved_path.display()))
    }
}

#[cfg(target_os = "windows")]
fn get_available_space_for_windows_path(path: &Path) -> Result<u64, String> {
    let wide_path: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut free_bytes = 0_u64;

    unsafe {
        GetDiskFreeSpaceExW(
            PCWSTR(wide_path.as_ptr()),
            Some(&mut free_bytes as *mut u64),
            None,
            None,
        )
    }
    .map(|_| free_bytes)
    .map_err(|error| {
        format!(
            "Failed to get available space for {}: {error}",
            path.display()
        )
    })
}

#[tauri::command(rename_all = "snake_case")]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || open_in_terminal_for_path(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn open_in_editor(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || open_in_editor_for_path(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn resolve_existing_path(path: &Path) -> Result<PathBuf, String> {
    let mut candidate = path;

    loop {
        if candidate.exists() {
            return match candidate.canonicalize() {
                Ok(path) => Ok(path),
                Err(_) => Ok(candidate.to_path_buf()),
            };
        }

        candidate = candidate.parent().ok_or_else(|| {
            format!("Could not resolve an existing volume path for {}", path.display())
        })?;
    }
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
            .map_err(|e| e.to_string())
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
                    .map_err(|e| e.to_string())
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
            if let Ok(status) = Command::new(program).args(args).arg(&terminal_path).status() {
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
            .map_err(|e| e.to_string())
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
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&resolved_path)
            .status()
            .map_err(|e| e.to_string())
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
