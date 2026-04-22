use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(not(target_os = "windows"))]
use sysinfo::Disks;
#[cfg(target_os = "windows")]
use windows::core::PCWSTR;
#[cfg(target_os = "windows")]
use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

#[tauri::command(rename_all = "snake_case")]
pub async fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| "Could not find home directory".to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn resolve_path(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || resolve_path_for_navigation(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_available_space(path: String) -> Result<u64, String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || get_available_space_for_path(&path))
        .await
        .map_err(|error| error.to_string())?
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
            .ok_or_else(|| {
                format!(
                    "Could not find a mounted volume for {}",
                    resolved_path.display()
                )
            })
    }
}

fn resolve_path_for_navigation(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Err(format!("{} does not exist", path.display()));
    }

    Ok(path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string())
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

pub(crate) fn resolve_existing_path(path: &Path) -> Result<PathBuf, String> {
    let mut candidate = path;

    loop {
        if candidate.exists() {
            return match candidate.canonicalize() {
                Ok(path) => Ok(path),
                Err(_) => Ok(candidate.to_path_buf()),
            };
        }

        candidate = candidate.parent().ok_or_else(|| {
            format!(
                "Could not resolve an existing volume path for {}",
                path.display()
            )
        })?;
    }
}
