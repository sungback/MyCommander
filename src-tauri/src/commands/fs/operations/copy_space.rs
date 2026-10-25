//! 복사·이동 전에 대상 볼륨에 남은 공간이 충분한지 확인한다.
//! 경고용이라 확인하지 못하면(오류, 시간 초과) 막지 않고 `insufficient: false`로 돌려준다.
use crate::commands::fs::metadata::scan_path_size_for_space_check;
use crate::commands::fs::shared::{validate_fs_path, validate_fs_paths};
use crate::commands::system::paths::{get_available_space_for_path, resolve_existing_path};
use serde::Serialize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

/// 크기 계산에 쓰는 최대 시간. 넘으면 그때까지 센 값(하한값)으로만 판단한다.
const SPACE_CHECK_TIME_BUDGET: Duration = Duration::from_millis(1500);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferSpaceCheck {
    /// 옮기는 데 필요한 크기. `complete`가 false면 실제보다 작을 수 있는 하한값이다.
    pub required_bytes: u64,
    /// 대상 볼륨의 남은 공간. 알 수 없으면 None.
    pub available_bytes: Option<u64>,
    /// 필요한 크기를 끝까지 셌으면 true
    pub complete: bool,
    /// 필요한 크기가 남은 공간보다 크다고 확인됐으면 true
    pub insufficient: bool,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn check_transfer_space(
    source_paths: Vec<String>,
    target_path: String,
    is_move: bool,
) -> Result<TransferSpaceCheck, String> {
    validate_fs_paths(&source_paths)?;
    validate_fs_path(&target_path)?;

    tokio::task::spawn_blocking(move || {
        let available = get_available_space_for_path(Path::new(&target_path)).ok();
        Ok(check_transfer_space_with(
            &source_paths,
            &target_path,
            is_move,
            available,
            SPACE_CHECK_TIME_BUDGET,
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(crate) fn check_transfer_space_with(
    source_paths: &[String],
    target_path: &str,
    is_move: bool,
    available: Option<u64>,
    time_budget: Duration,
) -> TransferSpaceCheck {
    let mut check = TransferSpaceCheck {
        required_bytes: 0,
        available_bytes: available,
        complete: true,
        insufficient: false,
    };
    let Some(available) = available else {
        check.complete = false;
        return check;
    };

    // 같은 볼륨 안의 이동은 이름 바꾸기라 공간이 들지 않는다.
    let target_volume = volume_key_for_target(Path::new(target_path));
    let sources: Vec<&String> = source_paths
        .iter()
        .filter(|source| {
            !is_move
                || target_volume.is_none()
                || volume_key_for_source(Path::new(source.as_str())) != target_volume
        })
        .collect();

    let deadline = Instant::now() + time_budget;
    let source_count = sources.len();
    for (index, source) in sources.into_iter().enumerate() {
        let base = check.required_bytes;
        let cancel_flag = AtomicBool::new(false);
        let mut counted = 0_u64;
        let outcome = scan_path_size_for_space_check(source, &cancel_flag, |size| {
            counted = size;
            // 이미 부족하다고 확인됐거나 시간을 다 쓰면 더 세지 않는다.
            if base.saturating_add(size) > available || Instant::now() >= deadline {
                cancel_flag.store(true, Ordering::Relaxed);
            }
        });

        match outcome {
            Ok(size) => check.required_bytes = base.saturating_add(size),
            Err(_) if cancel_flag.load(Ordering::Relaxed) => {
                check.required_bytes = base.saturating_add(counted);
                check.complete = false;
                break;
            }
            // 원본이 없어졌거나 읽지 못하면 복사 자체가 실패하므로 남은 원본만 계속 센다.
            Err(_) => check.complete = false,
        }

        // 원본 사이에서도 확인한다. 금방 끝나는 원본은 진행 콜백이 마지막에 한 번만 불려
        // 위의 취소가 다음 원본으로 이어지지 않기 때문이다.
        let has_more = index + 1 < source_count;
        if has_more && (check.required_bytes > available || Instant::now() >= deadline) {
            check.complete = false;
            break;
        }
    }

    check.insufficient = check.required_bytes > available;
    check
}

/// 볼륨을 구분하는 값. Unix는 장치 번호, Windows는 경로 접두어(드라이브 문자 또는 UNC 공유)다.
#[cfg(unix)]
type VolumeKey = u64;
#[cfg(not(unix))]
type VolumeKey = String;

/// 대상 경로는 아직 없을 수 있어(새 이름으로 복사) 존재하는 상위 폴더 기준으로 판단한다.
fn volume_key_for_target(path: &Path) -> Option<VolumeKey> {
    let resolved = resolve_existing_path(path).ok()?;
    volume_key(&resolved, false)
}

/// 원본은 링크 자체를 옮기므로 링크를 따라가지 않는다.
fn volume_key_for_source(path: &Path) -> Option<VolumeKey> {
    volume_key(path, true)
}

#[cfg(unix)]
fn volume_key(path: &Path, no_follow: bool) -> Option<VolumeKey> {
    use std::os::unix::fs::MetadataExt;

    let metadata = if no_follow {
        std::fs::symlink_metadata(path)
    } else {
        std::fs::metadata(path)
    };
    metadata.ok().map(|metadata| metadata.dev())
}

#[cfg(not(unix))]
fn volume_key(path: &Path, no_follow: bool) -> Option<VolumeKey> {
    use std::path::Component;

    // 원본은 상위 폴더로 판단해 링크가 가리키는 다른 드라이브로 잘못 보지 않는다.
    let base = if no_follow {
        path.parent().unwrap_or(path)
    } else {
        path
    };
    let resolved = resolve_existing_path(base).ok()?;
    match resolved.components().next()? {
        Component::Prefix(prefix) => Some(prefix.as_os_str().to_string_lossy().to_uppercase()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{check_transfer_space_with, TransferSpaceCheck};
    use std::fs;
    use std::path::PathBuf;
    use std::time::Duration;

    const BUDGET: Duration = Duration::from_secs(5);

    fn make_temp_dir(name: &str) -> PathBuf {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("mycommander-space-{name}-{unique}"));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn path_string(path: &std::path::Path) -> String {
        path.to_string_lossy().to_string()
    }

    /// 파일 100바이트 하나와, 파일 200·300바이트가 든 폴더 하나를 만든다(합계 600바이트).
    fn make_sources(root: &std::path::Path) -> Vec<String> {
        let folder = root.join("folder");
        fs::create_dir_all(folder.join("nested")).unwrap();
        fs::write(root.join("file.bin"), [1_u8; 100]).unwrap();
        fs::write(folder.join("a.bin"), [1_u8; 200]).unwrap();
        fs::write(folder.join("nested").join("b.bin"), [1_u8; 300]).unwrap();
        vec![path_string(&root.join("file.bin")), path_string(&folder)]
    }

    #[test]
    fn copy_counts_files_and_folders() {
        let root = make_temp_dir("copy");
        let sources = make_sources(&root);
        let target = root.join("target");
        fs::create_dir_all(&target).unwrap();

        let check =
            check_transfer_space_with(&sources, &path_string(&target), false, Some(10_000), BUDGET);

        assert_eq!(
            check,
            TransferSpaceCheck {
                required_bytes: 600,
                available_bytes: Some(10_000),
                complete: true,
                insufficient: false,
            }
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn copy_reports_insufficient_space() {
        let root = make_temp_dir("insufficient");
        let sources = make_sources(&root);

        let check =
            check_transfer_space_with(&sources, &path_string(&root), false, Some(50), BUDGET);

        assert!(check.insufficient);
        assert!(check.required_bytes > 50);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn move_within_the_same_volume_needs_no_space() {
        let root = make_temp_dir("same-volume-move");
        let sources = make_sources(&root);
        let target = root.join("target");
        fs::create_dir_all(&target).unwrap();

        // 남은 공간이 0이어도 같은 볼륨 안의 이동은 경고하지 않는다.
        let check =
            check_transfer_space_with(&sources, &path_string(&target), true, Some(0), BUDGET);

        assert_eq!(check.required_bytes, 0);
        assert!(check.complete);
        assert!(!check.insufficient);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn move_to_a_new_name_uses_the_existing_parent_volume() {
        let root = make_temp_dir("move-new-name");
        let sources = make_sources(&root);
        let target = root.join("not-yet").join("renamed.bin");

        let check =
            check_transfer_space_with(&sources[..1], &path_string(&target), true, Some(0), BUDGET);

        assert!(!check.insufficient);
        assert_eq!(check.required_bytes, 0);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stops_between_sources_when_the_time_budget_is_used_up() {
        let root = make_temp_dir("budget");
        let sources = make_sources(&root);

        let check = check_transfer_space_with(
            &sources,
            &path_string(&root),
            false,
            Some(10_000),
            Duration::ZERO,
        );

        // 첫 원본(100바이트 파일)만 세고 멈춘다.
        assert_eq!(check.required_bytes, 100);
        assert!(!check.complete);
        assert!(!check.insufficient);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stops_between_sources_once_space_is_known_to_be_short() {
        let root = make_temp_dir("short-early");
        let sources = make_sources(&root);

        let check =
            check_transfer_space_with(&sources, &path_string(&root), false, Some(50), BUDGET);

        assert_eq!(check.required_bytes, 100);
        assert!(!check.complete);
        assert!(check.insufficient);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn unknown_available_space_never_warns() {
        let root = make_temp_dir("unknown");
        let sources = make_sources(&root);

        let check = check_transfer_space_with(&sources, &path_string(&root), false, None, BUDGET);

        assert!(!check.insufficient);
        assert!(!check.complete);
        assert_eq!(check.available_bytes, None);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_source_is_skipped_without_failing() {
        let root = make_temp_dir("missing");
        let mut sources = make_sources(&root);
        sources.push(path_string(&root.join("gone.bin")));

        let check =
            check_transfer_space_with(&sources, &path_string(&root), false, Some(10_000), BUDGET);

        assert_eq!(check.required_bytes, 600);
        assert!(!check.complete);
        assert!(!check.insufficient);
        fs::remove_dir_all(root).unwrap();
    }
}
