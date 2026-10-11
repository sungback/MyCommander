use serde::Serialize;
use std::path::Path;

/// 경로가 놓인 저장소의 성격.
/// 이름만으로 클라우드로 오인되는 로컬 폴더를 구분하기 위해 쓴다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StorageKind {
    /// 파일 제공자(CloudStorage, iCloud 등) 아래에 있어 순회 시 네트워크 접근이 생길 수 있다.
    Provider,
    /// 파일 제공자와 무관한 일반 로컬 폴더로 확인됨.
    Local,
    /// 판단할 수 없음. 호출자는 이름 기반 판정을 그대로 쓴다.
    Unknown,
}

pub async fn classify_storage_paths(paths: Vec<String>) -> Result<Vec<StorageKind>, String> {
    tokio::task::spawn_blocking(move || {
        paths
            .iter()
            .map(|path| classify_storage_path(Path::new(path)))
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn classify_storage_path(path: &Path) -> StorageKind {
    if !path.is_absolute() || !path.is_dir() {
        return StorageKind::Unknown;
    }

    // 표시 경로(심볼릭 링크)와 실제 경로 양쪽을 모두 확인한다.
    let resolved = match path.canonicalize() {
        Ok(resolved) => resolved,
        Err(_) => return StorageKind::Unknown,
    };

    let mut result = StorageKind::Local;
    for candidate in [path, resolved.as_path()] {
        match classify_resolved_path(candidate) {
            StorageKind::Provider => return StorageKind::Provider,
            StorageKind::Unknown => result = StorageKind::Unknown,
            StorageKind::Local => {}
        }
    }

    result
}

#[cfg(not(target_os = "macos"))]
fn classify_storage_path(_path: &Path) -> StorageKind {
    StorageKind::Unknown
}

#[cfg(target_os = "macos")]
fn classify_resolved_path(path: &Path) -> StorageKind {
    let lowered = path.to_string_lossy().to_lowercase();

    if lowered.contains("/library/cloudstorage") || lowered.contains("/library/mobile documents") {
        return StorageKind::Provider;
    }

    // 외장·네트워크·FUSE 볼륨은 로컬 여부를 단정하지 않는다.
    if lowered.starts_with("/volumes/") {
        return StorageKind::Unknown;
    }

    if path.ancestors().any(has_file_provider_attribute) {
        return StorageKind::Provider;
    }

    StorageKind::Local
}

#[cfg(target_os = "macos")]
fn has_file_provider_attribute(path: &Path) -> bool {
    use std::ffi::CString;
    use std::os::raw::{c_char, c_int, c_void};
    use std::os::unix::ffi::OsStrExt;

    extern "C" {
        fn getxattr(
            path: *const c_char,
            name: *const c_char,
            value: *mut c_void,
            size: usize,
            position: u32,
            options: c_int,
        ) -> isize;
    }

    const XATTR_NOFOLLOW: c_int = 0x0001;

    let Ok(c_path) = CString::new(path.as_os_str().as_bytes()) else {
        return false;
    };
    let name = c"com.apple.file-provider-domain-id";

    // 크기 0으로 호출하면 속성이 있을 때 길이를, 없으면 -1을 돌려준다.
    let length = unsafe {
        getxattr(
            c_path.as_ptr(),
            name.as_ptr(),
            std::ptr::null_mut(),
            0,
            0,
            XATTR_NOFOLLOW,
        )
    };

    length >= 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_dir(label: &str) -> std::path::PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("mycommander-{label}-{id}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn plain_directory_named_like_cloud_drive_is_local() {
        let root = make_temp_dir("storage-local");
        let named = root.join("내 드라이브");
        fs::create_dir_all(&named).unwrap();

        assert_eq!(classify_storage_path(&named), StorageKind::Local);

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn directory_under_cloud_storage_is_provider() {
        let root = make_temp_dir("storage-provider");
        let provider = root
            .join("Library")
            .join("CloudStorage")
            .join("GoogleDrive-x");
        fs::create_dir_all(&provider).unwrap();

        assert_eq!(classify_storage_path(&provider), StorageKind::Provider);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_or_relative_paths_are_unknown() {
        assert_eq!(
            classify_storage_path(Path::new("/nonexistent/mycommander-storage")),
            StorageKind::Unknown
        );
        assert_eq!(
            classify_storage_path(Path::new("relative/path")),
            StorageKind::Unknown
        );
    }
}
