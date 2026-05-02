use super::paths::get_unique_extraction_dir;
use crate::commands::fs::shared::{describe_invalid_zip_problem, format_command_failure};
use std::fs;
use std::path::Path;

pub(super) fn extract_zip_archive(path: &str) -> Result<String, String> {
    use std::process::Command;

    let archive_path = Path::new(path);
    if !archive_path.is_file() {
        return Err(format!("{path} is not a file"));
    }

    let extension = archive_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default();
    if !extension.eq_ignore_ascii_case("zip") {
        return Err(format!("{path} is not a zip archive"));
    }

    let target_dir = get_unique_extraction_dir(archive_path)?;

    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    {
        let ditto_output = Command::new("ditto")
            .args(["-x", "-k"])
            .arg(archive_path)
            .arg(&target_dir)
            .output()
            .map_err(|e| {
                format!(
                    "Failed to run ditto while extracting archive into {}: {e}",
                    target_dir.display()
                )
            })?;

        if !ditto_output.status.success() {
            let ditto_error = format_command_failure("ditto", &ditto_output);

            let _ = fs::remove_dir_all(&target_dir);
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

            let unzip_output = Command::new("unzip")
                .args(["-q"])
                .arg(archive_path)
                .args(["-d"])
                .arg(&target_dir)
                .output()
                .map_err(|e| {
                    format!(
                        "Failed to run unzip fallback while extracting archive into {} after {ditto_error}: {e}",
                        target_dir.display()
                    )
                })?;

            if !unzip_output.status.success() {
                let _ = fs::remove_dir_all(&target_dir);
                let problem = describe_invalid_zip_problem([&ditto_output, &unzip_output]);
                return Err(format!(
                    "Failed to extract archive into {}. {} {ditto_error}; fallback {}",
                    target_dir.display(),
                    problem,
                    format_command_failure("unzip", &unzip_output)
                ));
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = Command::new("unzip")
            .args(["-q"])
            .arg(archive_path)
            .args(["-d"])
            .arg(&target_dir)
            .output()
            .map_err(|e| {
                format!(
                    "Failed to run unzip while extracting archive into {}: {e}",
                    target_dir.display()
                )
            })?;

        if !output.status.success() {
            let _ = fs::remove_dir_all(&target_dir);
            let problem = describe_invalid_zip_problem([&output]);
            return Err(format!(
                "Failed to extract archive into {}. {} {}",
                target_dir.display(),
                problem,
                format_command_failure("unzip", &output)
            ));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1]",
            ])
            .arg(archive_path)
            .arg(&target_dir)
            .output()
            .map_err(|e| {
                format!(
                    "Failed to run PowerShell while extracting archive into {}: {e}",
                    target_dir.display()
                )
            })?;

        if !output.status.success() {
            let _ = fs::remove_dir_all(&target_dir);
            let problem = describe_invalid_zip_problem([&output]);
            return Err(format!(
                "Failed to extract archive into {}. {} {}",
                target_dir.display(),
                problem,
                format_command_failure("powershell", &output)
            ));
        }
    }

    flatten_matching_archive_root_dir(&target_dir, archive_path)?;

    Ok(target_dir.to_string_lossy().to_string())
}

pub(crate) fn flatten_matching_archive_root_dir(
    extraction_dir: &Path,
    archive_path: &Path,
) -> Result<(), String> {
    let top_level_entries = fs::read_dir(extraction_dir)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if top_level_entries.len() != 1 {
        return Ok(());
    }

    let nested_root = &top_level_entries[0];
    if !nested_root.file_type().map_err(|e| e.to_string())?.is_dir() {
        return Ok(());
    }

    let nested_name = nested_root.file_name();
    let matches_archive_name = archive_path
        .file_stem()
        .is_some_and(|archive_stem| archive_stem == nested_name.as_os_str());
    let matches_target_name = extraction_dir
        .file_name()
        .is_some_and(|target_name| target_name == nested_name.as_os_str());

    if !matches_archive_name && !matches_target_name {
        return Ok(());
    }

    move_directory_contents(nested_root.path().as_path(), extraction_dir)?;
    fs::remove_dir(nested_root.path()).map_err(|e| e.to_string())
}

fn move_directory_contents(source_dir: &Path, target_dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(source_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let destination = target_dir.join(entry.file_name());
        fs::rename(entry.path(), destination).map_err(|e| e.to_string())?;
    }

    Ok(())
}
