use super::paths::get_unique_extraction_dir;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use crate::commands::fs::shared::{describe_invalid_zip_problem, format_command_failure};
use std::fs;
use std::path::Path;

pub(crate) fn extract_zip_archive(path: &str) -> Result<String, String> {
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

    let pre_meta = fs::metadata(archive_path).map_err(|e| e.to_string())?;
    if let Err(e) = validate_zip_entry_paths(archive_path) {
        let _ = fs::remove_dir_all(&target_dir);
        return Err(e);
    }
    let post_meta = fs::metadata(archive_path).map_err(|e| e.to_string())?;
    if pre_meta.len() != post_meta.len() || pre_meta.modified().ok() != post_meta.modified().ok() {
        let _ = fs::remove_dir_all(&target_dir);
        return Err("Archive was modified during security validation".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let ditto_output = Command::new("ditto")
            .args(["-x", "-k", "--"])
            .arg(archive_path)
            .arg(&target_dir)
            .output();

        let ditto_success = match &ditto_output {
            Ok(output) => output.status.success(),
            Err(_) => false,
        };

        if !ditto_success {
            let ditto_error = ditto_output
                .as_ref()
                .map(|out| format_command_failure("ditto", out))
                .unwrap_or_else(|e| format!("failed to execute ditto: {e}"));

            let _ = fs::remove_dir_all(&target_dir);
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

            let unzip_output = Command::new("unzip")
                .args(["-q"])
                .arg(archive_path)
                .args(["-d"])
                .arg(&target_dir)
                .output();

            let unzip_success = match &unzip_output {
                Ok(output) => output.status.success(),
                Err(_) => false,
            };

            if !unzip_success {
                let _ = fs::remove_dir_all(&target_dir);
                fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

                if let Err(native_err) = extract_zip_entries_native(archive_path, &target_dir) {
                    let _ = fs::remove_dir_all(&target_dir);
                    let mut outputs = Vec::new();
                    if let Ok(out) = &ditto_output {
                        outputs.push(out);
                    }
                    if let Ok(out) = &unzip_output {
                        outputs.push(out);
                    }
                    let problem = describe_invalid_zip_problem(outputs);
                    let unzip_error = unzip_output
                        .as_ref()
                        .map(|out| format_command_failure("unzip", out))
                        .unwrap_or_else(|e| format!("failed to execute unzip: {e}"));

                    return Err(format!(
                        "Failed to extract archive into {}. {} {ditto_error}; fallback {unzip_error}; native extraction failed: {native_err}",
                        target_dir.display(),
                        problem
                    ));
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let output = Command::new("unzip")
            .args(["-q"])
            .arg(archive_path)
            .args(["-d"])
            .arg(&target_dir)
            .output();

        let unzip_success = match &output {
            Ok(out) => out.status.success(),
            Err(_) => false,
        };

        if !unzip_success {
            let _ = fs::remove_dir_all(&target_dir);
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

            if let Err(native_err) = extract_zip_entries_native(archive_path, &target_dir) {
                let _ = fs::remove_dir_all(&target_dir);
                let mut outputs = Vec::new();
                if let Ok(out) = &output {
                    outputs.push(out);
                }
                let problem = describe_invalid_zip_problem(outputs);
                let unzip_error = output
                    .as_ref()
                    .map(|out| format_command_failure("unzip", out))
                    .unwrap_or_else(|e| format!("failed to execute unzip: {e}"));

                return Err(format!(
                    "Failed to extract archive into {}. {} {unzip_error}; native extraction failed: {native_err}",
                    target_dir.display(),
                    problem
                ));
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Err(err) = extract_zip_entries_native(archive_path, &target_dir) {
            let _ = fs::remove_dir_all(&target_dir);
            return Err(format!(
                "Failed to extract archive into {}: {err}",
                target_dir.display()
            ));
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        if let Err(err) = extract_zip_entries_native(archive_path, &target_dir) {
            let _ = fs::remove_dir_all(&target_dir);
            return Err(format!(
                "Failed to extract archive into {}: {err}",
                target_dir.display()
            ));
        }
    }

    flatten_matching_archive_root_dir(&target_dir, archive_path)?;

    Ok(target_dir.to_string_lossy().to_string())
}

pub(crate) fn extract_zip_entries_native(
    archive_path: &Path,
    target_dir: &Path,
) -> Result<(), String> {
    let file = fs::File::open(archive_path).map_err(|e| e.to_string())?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to open archive: {e}"))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read archive entry #{i}: {e}"))?;

        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| format!("Archive contains unsafe path entry: {}", entry.name()))?;
        let outpath = target_dir.join(enclosed);

        if entry.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory {}: {e}", outpath.display()))?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent).map_err(|e| {
                        format!(
                            "Failed to create parent directory {}: {e}",
                            parent.display()
                        )
                    })?;
                }
            }
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file {}: {e}", outpath.display()))?;
            std::io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Failed to write file {}: {e}", outpath.display()))?;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = entry.unix_mode() {
                let _ = fs::set_permissions(&outpath, fs::Permissions::from_mode(mode));
            }
        }
    }

    Ok(())
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

fn validate_zip_entry_paths(archive_path: &Path) -> Result<(), String> {
    let file = fs::File::open(archive_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to open archive for validation: {e}"))?;

    for i in 0..zip.len() {
        let entry = zip.by_index(i).map_err(|e| e.to_string())?;
        if entry.enclosed_name().is_none() {
            return Err(format!(
                "Archive contains unsafe path entry: {}",
                entry.name()
            ));
        }
    }
    Ok(())
}
