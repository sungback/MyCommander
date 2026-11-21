use crate::commands::fs::shared::validate_fs_path;
use serde::Serialize;
use std::fs::{self, Metadata, OpenOptions, Permissions};
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// 화면의 날짜 입력이 현실적인 범위를 벗어나는 값(예: 연도 9999)을 넘기지 못하게 막는다.
const MIN_MODIFIED_MS: i64 = -62_135_596_800_000; // 0001-01-01
const MAX_MODIFIED_MS: i64 = 253_402_300_799_000; // 9999-12-31

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct FileAttributes {
    pub modified_ms: Option<i64>,
    pub read_only: bool,
    pub is_dir: bool,
    pub is_symlink: bool,
}

fn ms_from_system_time(time: SystemTime) -> i64 {
    match time.duration_since(UNIX_EPOCH) {
        Ok(after) => after.as_millis() as i64,
        Err(before) => -(before.duration().as_millis() as i64),
    }
}

fn system_time_from_ms(ms: i64) -> Result<SystemTime, String> {
    if !(MIN_MODIFIED_MS..=MAX_MODIFIED_MS).contains(&ms) {
        return Err(format!("Modified time is out of range: {ms}"));
    }
    let magnitude = Duration::from_millis(ms.unsigned_abs());
    let time = if ms >= 0 {
        UNIX_EPOCH.checked_add(magnitude)
    } else {
        UNIX_EPOCH.checked_sub(magnitude)
    };
    time.ok_or_else(|| format!("Modified time is out of range: {ms}"))
}

// 유닉스에서는 쓰기 비트로 읽기 전용을 판단한다. 소유자 쓰기 비트가 없으면 읽기 전용이다.
#[cfg(unix)]
fn is_read_only(metadata: &Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode() & 0o200 == 0
}

#[cfg(not(unix))]
fn is_read_only(metadata: &Metadata) -> bool {
    metadata.permissions().readonly()
}

// 읽기 전용을 켜면 모든 쓰기 비트를 끄고, 끄면 소유자 쓰기 비트만 켠다.
// 표준 set_readonly(false)는 모두에게 쓰기를 열어 주므로 쓰지 않는다.
#[cfg(unix)]
fn with_read_only(current: &Permissions, read_only: bool) -> Permissions {
    use std::os::unix::fs::PermissionsExt;
    let mode = current.mode();
    let next = if read_only {
        mode & !0o222
    } else {
        mode | 0o200
    };
    Permissions::from_mode(next)
}

#[cfg(not(unix))]
fn with_read_only(current: &Permissions, read_only: bool) -> Permissions {
    let mut next = current.clone();
    next.set_readonly(read_only);
    next
}

fn set_read_only(path: &Path, current: &Permissions, read_only: bool) -> Result<(), String> {
    fs::set_permissions(path, with_read_only(current, read_only)).map_err(|error| error.to_string())
}

fn set_modified_time(path: &Path, is_dir: bool, time: SystemTime) -> Result<(), String> {
    let file = if is_dir {
        // 폴더는 쓰기로 열 수 없으므로 읽기로 연다. 유닉스에서만 시간을 바꿀 수 있다.
        #[cfg(unix)]
        {
            fs::File::open(path).map_err(|error| error.to_string())?
        }
        #[cfg(not(unix))]
        {
            return Err("이 운영체제에서는 폴더의 수정 시간을 바꿀 수 없습니다.".to_string());
        }
    } else {
        OpenOptions::new()
            .write(true)
            .open(path)
            .map_err(|error| error.to_string())?
    };
    file.set_modified(time).map_err(|error| error.to_string())
}

fn read_attributes(path: &Path) -> Result<FileAttributes, String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    Ok(FileAttributes {
        modified_ms: metadata.modified().ok().map(ms_from_system_time),
        read_only: is_read_only(&metadata),
        is_dir: metadata.is_dir(),
        is_symlink: metadata.file_type().is_symlink(),
    })
}

// 선택한 항목 자체의 수정 시간과 읽기 전용 표시를 바꾼다. 하위 항목에는 적용하지 않는다.
pub(crate) fn apply_file_attributes(
    path: &Path,
    modified_ms: Option<i64>,
    read_only: Option<bool>,
) -> Result<FileAttributes, String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("심볼릭 링크의 속성은 바꿀 수 없습니다.".to_string());
    }
    // 바꿀 값을 먼저 검증해 일부만 적용되는 일을 줄인다.
    let new_time = modified_ms.map(system_time_from_ms).transpose()?;

    let original_permissions = metadata.permissions();
    let was_read_only = is_read_only(&metadata);
    let final_read_only = read_only.unwrap_or(was_read_only);

    if let Some(time) = new_time {
        // 읽기 전용 파일은 쓰기로 열 수 없으므로 시간을 바꾸는 동안만 잠금을 푼다.
        let unlocked = was_read_only && !metadata.is_dir();
        if unlocked {
            set_read_only(path, &original_permissions, false)?;
        }
        if let Err(error) = set_modified_time(path, metadata.is_dir(), time) {
            if unlocked {
                let _ = fs::set_permissions(path, original_permissions);
            }
            return Err(error);
        }
    }

    // 시간을 바꾸는 동안 풀었던 잠금은 최종 값으로 다시 맞춘다.
    let current = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if is_read_only(&current) != final_read_only {
        set_read_only(path, &current.permissions(), final_read_only)?;
    }

    read_attributes(path)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_file_attributes(path: String) -> Result<FileAttributes, String> {
    validate_fs_path(&path)?;
    tokio::task::spawn_blocking(move || read_attributes(Path::new(&path)))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn set_file_attributes(
    path: String,
    modified_ms: Option<i64>,
    read_only: Option<bool>,
) -> Result<FileAttributes, String> {
    validate_fs_path(&path)?;
    tokio::task::spawn_blocking(move || {
        apply_file_attributes(Path::new(&path), modified_ms, read_only)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
#[path = "attributes_tests.rs"]
mod tests;
