use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(not(target_os = "windows"))]
use sysinfo::{Disk, Disks};

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
    #[serde(rename = "type")]
    device_type: String,
    icon: String,
    #[serde(rename = "isEjectable")]
    is_ejectable: bool,
    #[serde(rename = "availableSpace")]
    available_space: Option<u64>,
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
                    device_type: "system".to_string(),
                    icon: "drive".to_string(),
                    is_ejectable: false,
                    available_space: None,
                });
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let disks = Disks::new_with_refreshed_list();
        for disk in disks.list() {
            if let Some(info) = build_unix_drive_info(disk) {
                drives.push(info);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let disks = Disks::new_with_refreshed_list();
        for disk in disks.list() {
            if let Some(info) = build_unix_drive_info(disk) {
                drives.push(info);
            }
        }
    }

    sort_drives(&mut drives);
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
pub async fn open_file(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || open_file_with_default_app(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_show_hidden_menu_checked(app: tauri::AppHandle, checked: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let menu = app
            .menu()
            .ok_or_else(|| "Application menu is not available".to_string())?;

        let view_menu = menu
            .get("view")
            .and_then(|item| item.as_submenu().cloned())
            .ok_or_else(|| "View menu is not available".to_string())?;

        let show_hidden_item = view_menu
            .get("show_hidden_files")
            .and_then(|item| item.as_check_menuitem().cloned())
            .ok_or_else(|| "Show Hidden Files menu item is not available".to_string())?;

        show_hidden_item
            .set_checked(checked)
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = checked;
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn build_unix_drive_info(disk: &Disk) -> Option<DriveInfo> {
    let mount_point = disk.mount_point().to_string_lossy().to_string();
    let file_system = disk.file_system().to_string_lossy().to_lowercase();

    #[cfg(target_os = "macos")]
    if mount_point != "/" && !mount_point.starts_with("/Volumes/") {
        return None;
    }

    #[cfg(target_os = "linux")]
    if mount_point != "/" && !disk.is_removable() {
        return None;
    }

    let name = drive_name_for_mount(&mount_point, disk);
    let is_network = is_network_file_system(&file_system);
    let is_disk_image = cfg!(target_os = "macos") && disk.is_read_only() && mount_point.starts_with("/Volumes/");

    let (device_type, icon, is_ejectable) = if mount_point == "/" {
        ("system", "mac", false)
    } else if is_network {
        ("network", "network", true)
    } else if is_disk_image {
        ("disk-image", "disc", true)
    } else if disk.is_removable() {
        ("external", "usb", true)
    } else {
        ("volume", "drive", cfg!(target_os = "macos") && mount_point.starts_with("/Volumes/"))
    };

    Some(DriveInfo {
        mount_point,
        name,
        device_type: device_type.to_string(),
        icon: icon.to_string(),
        is_ejectable,
        available_space: Some(disk.available_space()),
    })
}

#[cfg(not(target_os = "windows"))]
fn drive_name_for_mount(mount_point: &str, disk: &Disk) -> String {
    if mount_point == "/" {
        #[cfg(target_os = "macos")]
        return "Macintosh HD".to_string();
        #[cfg(target_os = "linux")]
        return "Root".to_string();
    }

    Path::new(mount_point)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| disk.name().to_str().map(ToOwned::to_owned))
        .unwrap_or_else(|| mount_point.to_string())
}

#[cfg(not(target_os = "windows"))]
fn is_network_file_system(file_system: &str) -> bool {
    matches!(
        file_system,
        "smbfs" | "nfs" | "webdav" | "webdavfs" | "afpfs" | "cifs" | "davfs" | "fuse.sshfs"
    )
}

fn sort_drives(drives: &mut [DriveInfo]) {
    drives.sort_by(|a, b| {
        drive_sort_rank(&a.device_type)
            .cmp(&drive_sort_rank(&b.device_type))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
}

fn drive_sort_rank(device_type: &str) -> u8 {
    match device_type {
        "system" => 0,
        "external" => 1,
        "network" => 2,
        "disk-image" => 3,
        _ => 4,
    }
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
                .map_err(|e| e.to_string())?
        } else {
            Command::new("open")
                .arg(&resolved_path)
                .output()
                .map_err(|e| e.to_string())?
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
            .map_err(|e| e.to_string())
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
            .map_err(|e| e.to_string())
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
