use std::fs;
use std::path::Path;

pub async fn get_dir_size(path: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || compute_path_size(&path))
        .await
        .map_err(|e| e.to_string())?
}

pub(crate) fn compute_path_size(path: &str) -> Result<u64, String> {
    let target = Path::new(path);
    if !target.exists() {
        return Err(format!("{path} does not exist"));
    }

    if target.is_file() {
        return fs::metadata(target)
            .map(|metadata| metadata.len())
            .map_err(|e| e.to_string());
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    if let Ok(size) = get_dir_size_with_du(path) {
        return Ok(size);
    }

    get_dir_size_with_walkdir(path)
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn get_dir_size_with_du(path: &str) -> Result<u64, String> {
    use std::process::Command;

    let output = Command::new("du")
        .arg("-sk")
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed_size = parse_du_size_bytes(&stdout);
    if let Some(size) = parsed_size {
        return Ok(size);
    }

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Err("Failed to parse `du` output".to_string())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn parse_du_size_bytes(stdout: &str) -> Option<u64> {
    stdout
        .split_whitespace()
        .next()?
        .parse::<u64>()
        .ok()
        .map(|size_kb| size_kb.saturating_mul(1024))
}

fn get_dir_size_with_walkdir(path: &str) -> Result<u64, String> {
    use walkdir::WalkDir;

    let mut total_size = 0;
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();
            }
        }
    }

    Ok(total_size)
}

#[cfg(test)]
#[cfg(any(target_os = "macos", target_os = "linux"))]
mod tests {
    use super::parse_du_size_bytes;

    #[test]
    fn parse_du_size_bytes_reads_summary_even_with_other_output() {
        assert_eq!(parse_du_size_bytes("42\t/Users/example\n"), Some(43_008));
    }

    #[test]
    fn parse_du_size_bytes_returns_none_for_unparseable_output() {
        assert_eq!(parse_du_size_bytes(""), None);
        assert_eq!(parse_du_size_bytes("du: cannot read directory"), None);
    }
}
