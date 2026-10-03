use std::path::{Path, PathBuf};

/// Finds the enclosing macOS .app bundle directory for a given executable path.
#[cfg(any(target_os = "macos", test))]
#[allow(dead_code)]
pub fn find_app_bundle(current_exe: &Path) -> Option<PathBuf> {
    let mut p = current_exe;
    while let Some(parent) = p.parent() {
        if parent.extension().and_then(|ext| ext.to_str()) == Some("app") {
            return Some(parent.to_path_buf());
        }
        p = parent;
    }
    None
}

/// Applies an in-place self-update by downloading the release package and restarting the app.
#[tauri::command(rename_all = "snake_case")]
pub async fn apply_self_update(asset_url: String) -> Result<(), String> {
    if !asset_url.starts_with("https://") {
        return Err("유효하지 않은 다운로드 URL입니다.".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        apply_macos_update(&asset_url).await
    }

    #[cfg(target_os = "windows")]
    {
        apply_windows_update(&asset_url).await
    }

    #[cfg(target_os = "linux")]
    {
        apply_linux_update(&asset_url).await
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = asset_url;
        Err("지원되지 않는 운영체제입니다.".to_string())
    }
}

#[cfg(target_os = "macos")]
async fn apply_macos_update(asset_url: &str) -> Result<(), String> {
    let current_exe =
        std::env::current_exe().map_err(|e| format!("현재 실행 경로 확인 실패: {e}"))?;
    let current_bundle = find_app_bundle(&current_exe).ok_or_else(|| {
        "현재 환경(개발 모드 또는 바이너리 직접 실행)에서는 자동 업데이트를 지원하지 않습니다. 릴리즈 빌드(.app)에서 사용해 주세요.".to_string()
    })?;

    let temp_base = std::env::temp_dir().join(format!("mycommander_update_{}", std::process::id()));
    if temp_base.exists() {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
    }
    tokio::fs::create_dir_all(&temp_base)
        .await
        .map_err(|e| format!("임시 디렉터리 생성 실패: {e}"))?;

    let archive_path = temp_base.join("update.tar.gz");

    // Download archive via curl
    let curl_status = tokio::process::Command::new("curl")
        .args(["-fSL", asset_url, "-o", archive_path.to_str().unwrap()])
        .status()
        .await
        .map_err(|e| format!("다운로드 명령(curl) 실행 실패: {e}"))?;

    if !curl_status.success() {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
        return Err("업데이트 패키지 다운로드에 실패했습니다.".to_string());
    }

    // Extract archive via tar
    let extract_dir = temp_base.join("extracted");
    tokio::fs::create_dir_all(&extract_dir)
        .await
        .map_err(|e| format!("압축 해제 디렉터리 생성 실패: {e}"))?;

    let tar_status = tokio::process::Command::new("tar")
        .args([
            "-xzf",
            archive_path.to_str().unwrap(),
            "-C",
            extract_dir.to_str().unwrap(),
        ])
        .status()
        .await
        .map_err(|e| format!("압축 해제 명령(tar) 실행 실패: {e}"))?;

    if !tar_status.success() {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
        return Err("업데이트 패키지 압축 해제에 실패했습니다.".to_string());
    }

    // Find extracted MyCommander.app
    let mut new_app = extract_dir.join("MyCommander.app");
    if !new_app.exists() {
        let mut entries = tokio::fs::read_dir(&extract_dir)
            .await
            .map_err(|e| format!("압축 해제 목록 조회 실패: {e}"))?;
        let mut found = None;
        while let Ok(Some(entry)) = entries.next_entry().await {
            if entry.path().extension().and_then(|ext| ext.to_str()) == Some("app") {
                found = Some(entry.path());
                break;
            }
        }
        match found {
            Some(p) => new_app = p,
            None => {
                let _ = tokio::fs::remove_dir_all(&temp_base).await;
                return Err("압축 해제된 앱 번들(.app)을 찾을 수 없습니다.".to_string());
            }
        }
    }

    // Strip quarantine attribute just in case
    let _ = tokio::process::Command::new("xattr")
        .args(["-dr", "com.apple.quarantine", new_app.to_str().unwrap()])
        .status()
        .await;

    // Swap bundles
    let backup_path = current_bundle.with_extension(format!("app.old.{}", std::process::id()));

    let rename_result = tokio::fs::rename(&current_bundle, &backup_path).await;
    if rename_result.is_ok() {
        let ditto_status = tokio::process::Command::new("ditto")
            .args([new_app.to_str().unwrap(), current_bundle.to_str().unwrap()])
            .status()
            .await;

        if ditto_status.as_ref().map(|s| s.success()).unwrap_or(false) {
            let _ = tokio::fs::remove_dir_all(&backup_path).await;
            let _ = tokio::fs::remove_dir_all(&temp_base).await;
        } else {
            // Rollback on failure
            let _ = tokio::fs::rename(&backup_path, &current_bundle).await;
            let _ = tokio::fs::remove_dir_all(&temp_base).await;
            return Err("새 앱 번들 설치에 실패하여 이전 상태로 복구했습니다.".to_string());
        }
    } else {
        // Fallback: request administrator privileges via osascript
        let script = format!(
            "do shell script \"mv '{current}' '{backup}' && ditto '{new_app}' '{current}' && rm -rf '{backup}'\" with administrator privileges",
            current = current_bundle.display(),
            backup = backup_path.display(),
            new_app = new_app.display()
        );

        let osascript_status = tokio::process::Command::new("osascript")
            .args(["-e", &script])
            .status()
            .await
            .map_err(|e| format!("관리자 권한 프롬프트 실행 실패: {e}"))?;

        let _ = tokio::fs::remove_dir_all(&temp_base).await;

        if !osascript_status.success() {
            return Err("관리자 권한으로 앱을 교체하지 못했습니다.".to_string());
        }
    }

    // Spawn the updated application
    let bundle_str = current_bundle.to_string_lossy().to_string();
    tokio::process::Command::new("open")
        .args(["-n", &bundle_str])
        .spawn()
        .map_err(|e| format!("업데이트된 앱 실행 실패: {e}"))?;

    // Allow IPC response to return to webview, then exit
    tokio::spawn(async {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        std::process::exit(0);
    });

    Ok(())
}

#[cfg(target_os = "windows")]
async fn apply_windows_update(asset_url: &str) -> Result<(), String> {
    let temp_base = std::env::temp_dir().join(format!("mycommander_update_{}", std::process::id()));
    if temp_base.exists() {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
    }
    tokio::fs::create_dir_all(&temp_base)
        .await
        .map_err(|e| format!("임시 디렉터리 생성 실패: {e}"))?;

    let installer_path = temp_base.join("setup.exe");

    let curl_status = tokio::process::Command::new("curl")
        .args(["-fSL", asset_url, "-o", installer_path.to_str().unwrap()])
        .status()
        .await
        .map_err(|e| format!("다운로드 명령(curl) 실행 실패: {e}"))?;

    if !curl_status.success() {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
        return Err("설치 프로그램 다운로드에 실패했습니다.".to_string());
    }

    tokio::process::Command::new("cmd")
        .args(["/C", "start", "", installer_path.to_str().unwrap()])
        .spawn()
        .map_err(|e| format!("설치 프로그램 실행 실패: {e}"))?;

    tokio::spawn(async {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        std::process::exit(0);
    });

    Ok(())
}

#[cfg(target_os = "linux")]
async fn apply_linux_update(asset_url: &str) -> Result<(), String> {
    if let Ok(appimage_path) = std::env::var("APPIMAGE") {
        let appimage = PathBuf::from(appimage_path);
        let temp_base =
            std::env::temp_dir().join(format!("mycommander_update_{}", std::process::id()));
        if temp_base.exists() {
            let _ = tokio::fs::remove_dir_all(&temp_base).await;
        }
        tokio::fs::create_dir_all(&temp_base)
            .await
            .map_err(|e| format!("임시 디렉터리 생성 실패: {e}"))?;

        let new_appimage = temp_base.join("updated.AppImage");

        let curl_status = tokio::process::Command::new("curl")
            .args(["-fSL", asset_url, "-o", new_appimage.to_str().unwrap()])
            .status()
            .await
            .map_err(|e| format!("다운로드 명령(curl) 실행 실패: {e}"))?;

        if !curl_status.success() {
            let _ = tokio::fs::remove_dir_all(&temp_base).await;
            return Err("AppImage 다운로드에 실패했습니다.".to_string());
        }

        let chmod_status = tokio::process::Command::new("chmod")
            .args(["+x", new_appimage.to_str().unwrap()])
            .status()
            .await
            .map_err(|e| format!("실행 권한 부여 실패: {e}"))?;

        if !chmod_status.success() {
            let _ = tokio::fs::remove_dir_all(&temp_base).await;
            return Err("AppImage 실행 권한 설정에 실패했습니다.".to_string());
        }

        tokio::fs::rename(&new_appimage, &appimage)
            .await
            .map_err(|e| format!("AppImage 파일 교체 실패: {e}"))?;

        let _ = tokio::fs::remove_dir_all(&temp_base).await;

        tokio::process::Command::new(appimage.to_str().unwrap())
            .spawn()
            .map_err(|e| format!("업데이트된 AppImage 실행 실패: {e}"))?;

        tokio::spawn(async {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            std::process::exit(0);
        });

        Ok(())
    } else {
        Err("자동 업데이트는 AppImage 환경에서 지원됩니다. 배포판 패키지 관리자를 통해 업데이트해 주세요.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_find_app_bundle() {
        let exe_inside_app = Path::new("/Applications/MyCommander.app/Contents/MacOS/mycommander");
        assert_eq!(
            find_app_bundle(exe_inside_app),
            Some(PathBuf::from("/Applications/MyCommander.app"))
        );

        let exe_outside = Path::new("/target/debug/mycommander");
        assert_eq!(find_app_bundle(exe_outside), None);
    }
}
