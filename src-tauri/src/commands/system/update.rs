/// Finds the enclosing macOS .app bundle directory for a given executable path.
#[cfg(any(target_os = "macos", test))]
#[allow(dead_code)]
pub fn find_app_bundle(current_exe: &std::path::Path) -> Option<std::path::PathBuf> {
    let mut p = current_exe;
    while let Some(parent) = p.parent() {
        if parent.extension().and_then(|ext| ext.to_str()) == Some("app") {
            return Some(parent.to_path_buf());
        }
        p = parent;
    }
    None
}

/// 자체 업데이트로 내려받을 수 있는 유일한 위치. 웹뷰에서 임의 URL로 호출되어도 이 저장소의 릴리스 자산만 받는다.
const ALLOWED_UPDATE_URL_PREFIX: &str =
    "https://github.com/sungback/MyCommander/releases/download/";

/// 업데이트 URL이 이 저장소의 릴리스 자산이고 기대한 파일 종류인지 확인한다.
fn validate_update_url(url: &str, allowed_suffixes: &[&str]) -> Result<(), String> {
    let invalid = || "허용되지 않은 업데이트 URL입니다.".to_string();

    if !url.starts_with(ALLOWED_UPDATE_URL_PREFIX) {
        return Err(invalid());
    }

    // 경로 우회(`..`, 인코딩된 점), 쿼리·프래그먼트, 역슬래시, 공백·제어 문자는 허용하지 않는다.
    let lowered = url.to_lowercase();
    if lowered.contains("..")
        || lowered.contains("%2e")
        || lowered.contains("%2f")
        || lowered.contains("%5c")
        || url.contains(['?', '#', '\\'])
        || url.chars().any(|c| c.is_whitespace() || c.is_control())
    {
        return Err(invalid());
    }

    if !allowed_suffixes.iter().any(|suffix| url.ends_with(suffix)) {
        return Err(invalid());
    }

    Ok(())
}

/// 현재 플랫폼의 설치/업데이트 파일 확장자.
fn platform_update_suffixes() -> &'static [&'static str] {
    if cfg!(target_os = "macos") {
        &[".tar.gz"]
    } else if cfg!(target_os = "windows") {
        &[".exe"]
    } else {
        &[".AppImage"]
    }
}

/// curl이 HTTPS 외 프로토콜로 내려가거나 리다이렉트되지 않게 하는 옵션.
const CURL_HTTPS_ONLY_ARGS: [&str; 4] = ["--proto", "=https", "--proto-redir", "=https"];

/// 포터블 exe로 인정하는 최소 파일 크기. 오류 페이지 같은 작은 응답을 실행 파일로 오인하지 않기 위한 값이다.
#[cfg(any(target_os = "windows", test))]
const WINDOWS_PORTABLE_MIN_BYTES: u64 = 1_000_000;

/// 설치 프로그램이 둔 `uninstall.exe`가 없고 보호된 설치 폴더(Program Files 등)와 빌드 출력 폴더 밖에 있으면
/// 포터블 실행으로 본다.
#[cfg(any(target_os = "windows", test))]
fn is_portable_exe_location(
    exe_dir: &std::path::Path,
    has_uninstaller: bool,
    protected_roots: &[std::path::PathBuf],
) -> bool {
    if has_uninstaller {
        return false;
    }

    let dir = exe_dir.to_string_lossy().to_lowercase().replace('/', "\\");
    if dir.contains("\\target\\debug") || dir.contains("\\target\\release") {
        return false;
    }

    !protected_roots.iter().any(|root| {
        let root = root.to_string_lossy().to_lowercase().replace('/', "\\");
        !root.is_empty() && dir.starts_with(&root)
    })
}

/// 내려받은 파일이 Windows 실행 파일(PE, 앞 두 바이트가 `MZ`)로 보이는지 확인한다.
#[cfg(any(target_os = "windows", test))]
fn looks_like_windows_executable(size: u64, header: &[u8]) -> bool {
    size >= WINDOWS_PORTABLE_MIN_BYTES && header.starts_with(b"MZ")
}

/// `codesign -dv --verbose=2` 출력에서 TeamIdentifier 값을 꺼낸다. 서명이 없거나 `not set`이거나
/// 대문자·숫자 10자가 아니면 None. 값은 코드 요구사항 문자열에 들어가므로 형식을 엄격히 본다.
#[cfg(any(target_os = "macos", test))]
fn parse_team_identifier(codesign_output: &str) -> Option<String> {
    codesign_output
        .lines()
        .find_map(|line| line.strip_prefix("TeamIdentifier="))
        .map(str::trim)
        .filter(|team| {
            team.len() == 10
                && team
                    .chars()
                    .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
        })
        .map(str::to_string)
}

/// 이전 업데이트에서 이름을 바꿔 둔 실행 파일(`.old`)을 지운다. 이전 프로세스가 끝나기 전에는 지워지지 않으므로 잠시 재시도한다.
pub fn cleanup_replaced_executable() {
    #[cfg(target_os = "windows")]
    {
        let Ok(current_exe) = std::env::current_exe() else {
            return;
        };
        let backup = current_exe.with_extension("exe.old");
        if !backup.exists() {
            return;
        }

        std::thread::spawn(move || {
            for _ in 0..20 {
                if std::fs::remove_file(&backup).is_ok() || !backup.exists() {
                    return;
                }
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
        });
    }
}

/// Applies an in-place self-update by downloading the release package and restarting the app.
///
/// `portable_asset_url`은 Windows 포터블 실행일 때만 쓰이며, 없으면 기존 설치 프로그램 방식으로 갱신한다.
#[tauri::command(rename_all = "snake_case")]
pub async fn apply_self_update(
    asset_url: String,
    portable_asset_url: Option<String>,
) -> Result<(), String> {
    validate_update_url(&asset_url, platform_update_suffixes())?;

    if let Some(portable_url) = portable_asset_url.as_deref() {
        validate_update_url(portable_url, &["-portable.exe"])?;
    }

    #[cfg(target_os = "macos")]
    {
        apply_macos_update(&asset_url).await
    }

    #[cfg(target_os = "windows")]
    {
        if let (Some(portable_url), Some(current_exe)) =
            (portable_asset_url.as_deref(), detect_portable_exe())
        {
            return apply_windows_portable_update(portable_url, &current_exe).await;
        }

        apply_windows_update(&asset_url).await
    }

    #[cfg(target_os = "linux")]
    {
        apply_linux_update(&asset_url).await
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (asset_url, portable_asset_url);
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
        .args(CURL_HTTPS_ONLY_ARGS)
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

    if let Err(error) = verify_update_bundle_signature(&current_bundle, &new_app).await {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
        return Err(error);
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
        let script = build_admin_swap_script(&current_bundle, &backup_path, &new_app);

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

/// 관리자 권한으로 앱 번들을 교체하는 AppleScript. 경로는 셸 따옴표와 AppleScript 문자열 순서로 이스케이프한다.
#[cfg(target_os = "macos")]
fn build_admin_swap_script(
    current: &std::path::Path,
    backup: &std::path::Path,
    new_app: &std::path::Path,
) -> String {
    use super::launch::shell::{escape_applescript_string, shell_escape_single_quotes};

    let quote = |path: &std::path::Path| {
        format!("'{}'", shell_escape_single_quotes(&path.to_string_lossy()))
    };
    let (current, backup, new_app) = (quote(current), quote(backup), quote(new_app));
    let command = format!("mv {current} {backup} && ditto {new_app} {current} && rm -rf {backup}");

    format!(
        "do shell script \"{}\" with administrator privileges",
        escape_applescript_string(&command)
    )
}

/// 내려받은 앱이 Apple 인증서 체인으로 서명됐고, 지금 실행 중인 앱과 같은 개발자 팀 소유인지 확인한다.
/// 신뢰할 팀은 실행 중인 앱의 서명에서만 읽고, 내려받은 앱의 codesign 출력은 해석하지 않는다.
/// `anchor apple generic`이 없으면 같은 팀 ID를 적은 자체 서명 인증서도 통과하므로 반드시 붙인다.
/// 서명 정보를 읽을 수 없으면(서명 없는 빌드 포함) 교체하지 않는다.
#[cfg(target_os = "macos")]
async fn verify_update_bundle_signature(
    current_bundle: &std::path::Path,
    new_app: &std::path::Path,
) -> Result<(), String> {
    let team = bundle_team_identifier(current_bundle).await?;
    let requirement = format!("anchor apple generic and certificate leaf[subject.OU] = \"{team}\"");

    let verify_status = tokio::process::Command::new("codesign")
        .args(["--verify", "--deep", "--strict"])
        .arg(format!("-R={requirement}"))
        .arg(new_app)
        .status()
        .await
        .map_err(|e| format!("서명 검증 명령(codesign) 실행 실패: {e}"))?;
    if !verify_status.success() {
        return Err(
            "내려받은 앱의 코드 서명이 올바르지 않거나 현재 앱과 같은 개발자 팀이 아니어서 업데이트를 중단했습니다."
                .to_string(),
        );
    }

    Ok(())
}

#[cfg(target_os = "macos")]
async fn bundle_team_identifier(bundle: &std::path::Path) -> Result<String, String> {
    let output = tokio::process::Command::new("codesign")
        .args(["-dv", "--verbose=2"])
        .arg(bundle)
        .output()
        .await
        .map_err(|e| format!("서명 정보 확인 명령(codesign) 실행 실패: {e}"))?;

    // codesign은 서명 정보를 stderr로 출력한다.
    parse_team_identifier(&String::from_utf8_lossy(&output.stderr))
        .ok_or_else(|| format!("서명 팀 정보를 확인할 수 없습니다: {}", bundle.display()))
}

/// 포터블로 실행 중이면 현재 exe 경로를 반환한다.
#[cfg(target_os = "windows")]
fn detect_portable_exe() -> Option<std::path::PathBuf> {
    let current_exe = std::env::current_exe().ok()?;
    let exe_dir = current_exe.parent()?;
    let has_uninstaller = exe_dir.join("uninstall.exe").exists();
    let protected_roots: Vec<std::path::PathBuf> =
        ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"]
            .iter()
            .filter_map(std::env::var_os)
            .map(std::path::PathBuf::from)
            .collect();

    is_portable_exe_location(exe_dir, has_uninstaller, &protected_roots).then_some(current_exe)
}

/// 포터블 exe를 내려받아 실행 중인 exe를 교체하고 다시 실행한다.
/// 실행 중인 exe는 삭제·덮어쓰기가 안 되지만 이름 변경은 가능하므로 `.old`로 옮긴 뒤 새 파일을 제자리에 둔다.
#[cfg(target_os = "windows")]
async fn apply_windows_portable_update(
    portable_url: &str,
    current_exe: &std::path::Path,
) -> Result<(), String> {
    use std::io::Read;

    let temp_base = std::env::temp_dir().join(format!("mycommander_update_{}", std::process::id()));
    if temp_base.exists() {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
    }
    tokio::fs::create_dir_all(&temp_base)
        .await
        .map_err(|e| format!("임시 디렉터리 생성 실패: {e}"))?;

    let downloaded = temp_base.join("portable.exe");
    let curl_status = tokio::process::Command::new("curl")
        .args(CURL_HTTPS_ONLY_ARGS)
        .args(["-fSL", portable_url, "-o", downloaded.to_str().unwrap()])
        .status()
        .await
        .map_err(|e| format!("다운로드 명령(curl) 실행 실패: {e}"))?;

    if !curl_status.success() {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
        return Err("포터블 실행 파일 다운로드에 실패했습니다.".to_string());
    }

    let size = std::fs::metadata(&downloaded)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let mut header = [0_u8; 2];
    let header_len = std::fs::File::open(&downloaded)
        .and_then(|mut file| file.read(&mut header))
        .unwrap_or(0);
    if !looks_like_windows_executable(size, &header[..header_len]) {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
        return Err("내려받은 파일이 올바른 실행 파일이 아닙니다.".to_string());
    }

    // 같은 폴더에 먼저 복사해 두어야 이름 변경이 드라이브를 건너지 않는다.
    let staged = current_exe.with_extension("exe.new");
    let backup = current_exe.with_extension("exe.old");
    let _ = std::fs::remove_file(&staged);
    let _ = std::fs::remove_file(&backup);

    if let Err(e) = std::fs::copy(&downloaded, &staged) {
        let _ = tokio::fs::remove_dir_all(&temp_base).await;
        return Err(format!(
            "새 실행 파일을 현재 폴더에 쓰지 못했습니다. 쓰기 권한이 있는 폴더에서 실행해 주세요: {e}"
        ));
    }
    let _ = tokio::fs::remove_dir_all(&temp_base).await;

    if let Err(e) = std::fs::rename(current_exe, &backup) {
        let _ = std::fs::remove_file(&staged);
        return Err(format!("현재 실행 파일의 이름을 바꾸지 못했습니다: {e}"));
    }

    if let Err(e) = std::fs::rename(&staged, current_exe) {
        // 새 파일을 제자리에 두지 못하면 이전 파일로 되돌린다.
        let _ = std::fs::rename(&backup, current_exe);
        let _ = std::fs::remove_file(&staged);
        return Err(format!(
            "새 실행 파일을 설치하지 못해 이전 상태로 복구했습니다: {e}"
        ));
    }

    std::process::Command::new(current_exe)
        .spawn()
        .map_err(|e| format!("업데이트된 앱 실행 실패: {e}"))?;

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
        .args(CURL_HTTPS_ONLY_ARGS)
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
        let appimage = std::path::PathBuf::from(appimage_path);
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
            .args(CURL_HTTPS_ONLY_ARGS)
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
    use std::path::{Path, PathBuf};

    #[test]
    fn parse_team_identifier_reads_team_and_rejects_unsigned() {
        assert_eq!(
            parse_team_identifier("Identifier=com.x\nTeamIdentifier=6T338B4T7M\nSealed Resources"),
            Some("6T338B4T7M".to_string())
        );
        assert_eq!(parse_team_identifier("TeamIdentifier=not set"), None);
        assert_eq!(parse_team_identifier("TeamIdentifier=ABC\" or true"), None);
        assert_eq!(parse_team_identifier("TeamIdentifier=6t338b4t7m"), None);
        assert_eq!(parse_team_identifier("Identifier=com.x"), None);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn admin_swap_script_escapes_quotes_in_paths() {
        let script = build_admin_swap_script(
            Path::new("/Applications/Bob's \"Tools\"/MyCommander.app"),
            Path::new("/Applications/Bob's \"Tools\"/MyCommander.app.old.1"),
            Path::new("/tmp/x/MyCommander.app"),
        );

        // 셸: ' -> '\'' , AppleScript: \ -> \\ , " -> \"
        assert!(script.contains(r#"Bob'\\''s \"Tools\""#));
        assert!(script.starts_with("do shell script \"mv '/Applications/"));
        assert!(script.ends_with("\" with administrator privileges"));
    }

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

    #[test]
    fn portable_location_requires_no_uninstaller_and_unprotected_folder() {
        let program_files = vec![PathBuf::from(r"C:\Program Files")];

        assert!(is_portable_exe_location(
            Path::new(r"D:\Tools\MyCommander"),
            false,
            &program_files
        ));
        assert!(!is_portable_exe_location(
            Path::new(r"C:\Users\sam\AppData\Local\MyCommander"),
            true,
            &program_files
        ));
        assert!(!is_portable_exe_location(
            Path::new(r"c:\program files\MyCommander"),
            false,
            &program_files
        ));
        assert!(!is_portable_exe_location(
            Path::new(r"C:\code\MyCommander\src-tauri\target\release"),
            false,
            &program_files
        ));
    }

    #[test]
    fn executable_check_rejects_small_or_non_pe_downloads() {
        assert!(looks_like_windows_executable(2_000_000, b"MZ"));
        assert!(!looks_like_windows_executable(500, b"MZ"));
        assert!(!looks_like_windows_executable(2_000_000, b"<h"));
        assert!(!looks_like_windows_executable(2_000_000, b""));
    }

    #[test]
    fn update_url_allows_only_release_assets_of_this_repository() {
        let base = "https://github.com/sungback/MyCommander/releases/download/v1.2.54";

        assert!(validate_update_url(
            &format!("{base}/MyCommander_1.2.54_x64-setup.exe"),
            &[".exe"]
        )
        .is_ok());
        assert!(validate_update_url(
            &format!("{base}/MyCommander_1.2.54_x64-portable.exe"),
            &["-portable.exe"]
        )
        .is_ok());
        assert!(validate_update_url(
            &format!("{base}/MyCommander_aarch64.app.tar.gz"),
            &[".tar.gz"]
        )
        .is_ok());
    }

    #[test]
    fn update_url_rejects_other_hosts_repositories_and_tricks() {
        let rejected = [
            "http://github.com/sungback/MyCommander/releases/download/v1/a.exe",
            "https://evil.example.com/sungback/MyCommander/releases/download/v1/a.exe",
            "https://github.com.evil.example.com/sungback/MyCommander/releases/download/v1/a.exe",
            "https://github.com/other/MyCommander/releases/download/v1/a.exe",
            "https://github.com/sungback/MyCommander/archive/refs/heads/main.exe",
            "https://github.com/sungback/MyCommander/releases/download/../../../evil/a.exe",
            "https://github.com/sungback/MyCommander/releases/download/v1/%2e%2e/a.exe",
            "https://github.com/sungback/MyCommander/releases/download/v1/a.exe?x=1",
            "https://github.com/sungback/MyCommander/releases/download/v1/a.exe#frag",
            "https://github.com/sungback/MyCommander/releases/download/v1/a b.exe",
            "file:///C:/Windows/System32/cmd.exe",
        ];

        for url in rejected {
            assert!(
                validate_update_url(url, &[".exe"]).is_err(),
                "should reject: {url}"
            );
        }
    }

    #[test]
    fn update_url_rejects_unexpected_file_types() {
        let url = "https://github.com/sungback/MyCommander/releases/download/v1/a.msi";

        assert!(validate_update_url(url, &[".exe"]).is_err());
        assert!(validate_update_url(
            "https://github.com/sungback/MyCommander/releases/download/v1/a-setup.exe",
            &["-portable.exe"]
        )
        .is_err());
    }
}
