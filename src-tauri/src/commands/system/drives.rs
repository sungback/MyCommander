use serde::Serialize;

#[cfg(not(target_os = "windows"))]
use std::path::Path;
#[cfg(not(target_os = "windows"))]
use sysinfo::{Disk, Disks};

#[cfg(target_os = "windows")]
use windows::Win32::Storage::FileSystem::GetLogicalDrives;

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
        for index in 0..26 {
            if (mask & (1 << index)) != 0 {
                let letter = (b'A' + index as u8) as char;
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
    let is_disk_image =
        cfg!(target_os = "macos") && disk.is_read_only() && mount_point.starts_with("/Volumes/");

    let (device_type, icon, is_ejectable) = if mount_point == "/" {
        ("system", "mac", false)
    } else if is_network {
        ("network", "network", true)
    } else if is_disk_image {
        ("disk-image", "disc", true)
    } else if disk.is_removable() {
        ("external", "usb", true)
    } else {
        (
            "volume",
            "drive",
            cfg!(target_os = "macos") && mount_point.starts_with("/Volumes/"),
        )
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
