use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::Emitter;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub operation: String,
    pub current: usize,
    pub total: usize,
    pub current_file: String,
}

#[cfg(target_os = "macos")]
use std::os::macos::fs::MetadataExt;
#[cfg(target_os = "macos")]
use trash::macos::{DeleteMethod, TrashContextExtMacos};

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    kind: String, // "file", "directory", "symlink"
    size: Option<u64>,
    #[serde(rename = "lastModified")]
    last_modified: Option<u64>,
    #[serde(rename = "isHidden")]
    is_hidden: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BatchRenameOperation {
    old_path: String,
    new_path: String,
}

#[derive(Clone)]
struct PreparedBatchRenameOperation {
    old_path: PathBuf,
    new_path: PathBuf,
    temp_path: PathBuf,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn list_directory(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.is_dir() {
        return Err(format!("{} is not a directory", path));
    }

    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();

    // Add parent directory ".." if not root
    if let Some(parent) = dir_path.parent() {
        files.push(FileEntry {
            name: "..".to_string(),
            path: parent.to_string_lossy().to_string(),
            kind: "directory".to_string(),
            size: None,
            last_modified: None,
            is_hidden: false,
        });
    }

    for entry in entries {
        if let Ok(entry) = entry {
            let metadata = entry.metadata().map_err(|e| e.to_string());
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_path = entry.path().to_string_lossy().to_string();

            if let Ok(meta) = metadata {
                let is_hidden = is_hidden_entry(&file_name, &meta);

                if is_hidden && !show_hidden {
                    continue;
                }

                let kind = if meta.is_dir() {
                    "directory".to_string()
                } else if meta.is_symlink() {
                    "symlink".to_string()
                } else {
                    "file".to_string()
                };

                let size = if meta.is_dir() {
                    None
                } else {
                    Some(meta.len())
                };

                let last_modified = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64);

                files.push(FileEntry {
                    name: file_name,
                    path: file_path,
                    kind,
                    size,
                    last_modified,
                    is_hidden,
                });
            }
        }
    }

    // Sort: directories first, then alphabetical
    files.sort_by(|a, b| {
        if a.name == ".." {
            return std::cmp::Ordering::Less;
        }
        if b.name == ".." {
            return std::cmp::Ordering::Greater;
        }
        if a.kind != b.kind {
            if a.kind == "directory" {
                return std::cmp::Ordering::Less;
            } else if b.kind == "directory" {
                return std::cmp::Ordering::Greater;
            }
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });

    Ok(files)
}

fn is_hidden_entry(file_name: &str, metadata: &fs::Metadata) -> bool {
    if file_name == "." || file_name == ".." {
        return false;
    }

    if file_name.starts_with('.') {
        return true;
    }

    #[cfg(target_os = "macos")]
    {
        const UF_HIDDEN: u32 = 0x0000_8000;
        return metadata.st_flags() & UF_HIDDEN != 0;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = metadata;
        false
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_file(path: String) -> Result<(), String> {
    fs::File::create(&path)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_files(paths: Vec<String>, permanent: bool) -> Result<(), String> {
    let paths = collapse_nested_paths(paths);

    for path in paths {
        let p = Path::new(&path);
        if permanent {
            if p.is_dir() {
                fs::remove_dir_all(p).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(p).map_err(|e| e.to_string())?;
            }
        } else {
            move_to_trash(p).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn apply_batch_rename(operations: Vec<BatchRenameOperation>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || apply_batch_rename_operations(operations))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn copy_files(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_path: String,
) -> Result<(), String> {
    let total = source_paths.len();
    tokio::task::spawn_blocking(move || {
        if source_paths.is_empty() {
            return Ok(());
        }

        if source_paths.len() == 1 {
            let file_name = Path::new(&source_paths[0])
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| source_paths[0].clone());
            let _ = app.emit(
                "fs-progress",
                ProgressPayload {
                    operation: "copy".to_string(),
                    current: 1,
                    total,
                    current_file: file_name,
                },
            );
            return copy_single_path(Path::new(&source_paths[0]), &target_path);
        }

        let target_root = Path::new(&target_path);
        fs::create_dir_all(target_root).map_err(|e| e.to_string())?;
        if !target_root.is_dir() {
            return Err(format!("{target_path} is not a directory"));
        }

        for (i, source) in source_paths.iter().enumerate() {
            let file_name = Path::new(source)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| source.clone());
            let _ = app.emit(
                "fs-progress",
                ProgressPayload {
                    operation: "copy".to_string(),
                    current: i + 1,
                    total,
                    current_file: file_name,
                },
            );
            copy_path_into_dir(Path::new(source), target_root)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn move_files(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_dir: String,
) -> Result<(), String> {
    let total = source_paths.len();
    for (i, path) in source_paths.iter().enumerate() {
        let src = Path::new(path);
        if let Some(file_name) = src.file_name() {
            let file_name_str = file_name.to_string_lossy().to_string();
            let _ = app.emit(
                "fs-progress",
                ProgressPayload {
                    operation: "move".to_string(),
                    current: i + 1,
                    total,
                    current_file: file_name_str,
                },
            );
            let dest = Path::new(&target_dir).join(file_name);
            fs::rename(src, dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn extract_zip(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || extract_zip_archive(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_zip(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || create_zip_archive(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_zip_from_paths(
    paths: Vec<String>,
    target_dir: String,
    archive_name: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        create_zip_archive_from_paths(&paths, &target_dir, &archive_name)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn read_file_content(path: String) -> Result<String, String> {
    use std::io::Read;
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;

    // Read only first 100KB to prevent UI lag on huge files
    let mut buffer = String::new();
    file.take(100 * 1024)
        .read_to_string(&mut buffer)
        .map_err(|e| e.to_string())?;

    Ok(buffer)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_dir_size(path: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || compute_path_size(&path))
        .await
        .map_err(|e| e.to_string())?
}

fn compute_path_size(path: &str) -> Result<u64, String> {
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

fn extract_zip_archive(path: &str) -> Result<String, String> {
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
    let status = Command::new("ditto")
        .args(["-x", "-k"])
        .arg(archive_path)
        .arg(&target_dir)
        .status()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    let status = Command::new("unzip")
        .args(["-q"])
        .arg(archive_path)
        .args(["-d"])
        .arg(&target_dir)
        .status()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1]",
        ])
        .arg(archive_path)
        .arg(&target_dir)
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        let _ = fs::remove_dir_all(&target_dir);
        return Err(format!(
            "Failed to extract archive into {}",
            target_dir.display()
        ));
    }
    Ok(target_dir.to_string_lossy().to_string())
}

fn create_zip_archive(path: &str) -> Result<String, String> {
    use std::process::Command;

    let source_dir = Path::new(path);
    if !source_dir.is_dir() {
        return Err(format!("{path} is not a directory"));
    }

    let archive_path = get_unique_archive_path(source_dir)?;

    #[cfg(target_os = "macos")]
    let status = Command::new("ditto")
        .args(["-c", "-k", "."])
        .current_dir(source_dir)
        .arg(&archive_path)
        .status()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    let status = Command::new("zip")
        .args(["-rq"])
        .arg(&archive_path)
        .arg(".")
        .current_dir(source_dir)
        .status()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "$items = @(Get-ChildItem -LiteralPath $args[0] -Force); if ($items.Count -eq 0) { throw 'Cannot compress an empty directory.' }; Compress-Archive -LiteralPath $items.FullName -DestinationPath $args[1]",
        ])
        .arg(source_dir)
        .arg(&archive_path)
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        let _ = fs::remove_file(&archive_path);
        return Err(format!(
            "Failed to create archive at {}",
            archive_path.display()
        ));
    }

    Ok(archive_path.to_string_lossy().to_string())
}

fn get_unique_extraction_dir(archive_path: &Path) -> Result<PathBuf, String> {
    let parent_dir = archive_path.parent().ok_or_else(|| {
        format!(
            "Could not find parent directory for {}",
            archive_path.display()
        )
    })?;
    let stem = archive_path
        .file_stem()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("Archive");

    let initial_target = parent_dir.join(stem);
    if !initial_target.exists() {
        return Ok(initial_target);
    }

    for suffix in 2.. {
        let candidate = parent_dir.join(format!("{stem} {suffix}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Could not find a unique extraction directory for {}",
        archive_path.display()
    ))
}

fn get_unique_archive_path(source_dir: &Path) -> Result<PathBuf, String> {
    let parent_dir = source_dir.parent().ok_or_else(|| {
        format!(
            "Could not find parent directory for {}",
            source_dir.display()
        )
    })?;
    let stem = source_dir
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("Archive");

    let initial_target = parent_dir.join(format!("{stem}.zip"));
    if !initial_target.exists() {
        return Ok(initial_target);
    }

    for suffix in 2.. {
        let candidate = parent_dir.join(format!("{stem} {suffix}.zip"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Could not find a unique archive path for {}",
        source_dir.display()
    ))
}

fn get_unique_archive_path_named(target_dir: &Path, stem: &str) -> Result<PathBuf, String> {
    let initial = target_dir.join(format!("{stem}.zip"));
    if !initial.exists() {
        return Ok(initial);
    }
    for suffix in 2.. {
        let candidate = target_dir.join(format!("{stem} {suffix}.zip"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(format!("Could not find a unique archive path for {stem}"))
}

fn create_zip_archive_from_paths(
    paths: &[String],
    target_dir: &str,
    archive_name: &str,
) -> Result<String, String> {
    use std::process::Command;

    if paths.is_empty() {
        return Err("No paths provided".to_string());
    }

    let target_dir_path = Path::new(target_dir);
    let stem = if archive_name.is_empty() {
        "Archive"
    } else {
        archive_name
    };
    let archive_path = get_unique_archive_path_named(target_dir_path, stem)?;

    // Collect only the file/folder names (relative to target_dir) that exist
    let item_names: Vec<String> = paths
        .iter()
        .filter_map(|p| {
            let path = Path::new(p);
            if path.exists() {
                path.file_name()?.to_str().map(|s| s.to_owned())
            } else {
                None
            }
        })
        .collect();

    if item_names.is_empty() {
        return Err("No valid paths to compress".to_string());
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let status = {
        let mut cmd = Command::new("zip");
        cmd.arg("-r").arg(&archive_path);
        for name in &item_names {
            cmd.arg(name);
        }
        cmd.current_dir(target_dir_path)
            .status()
            .map_err(|e| e.to_string())?
    };

    #[cfg(target_os = "windows")]
    let status = {
        let paths_ps = item_names
            .iter()
            .map(|n| {
                format!(
                    "'{}'",
                    target_dir_path
                        .join(n)
                        .to_string_lossy()
                        .replace('\'', "''")
                )
            })
            .collect::<Vec<_>>()
            .join(",");
        let dest = archive_path.to_string_lossy();
        let script = format!(
            "Compress-Archive -LiteralPath {} -DestinationPath '{}'",
            paths_ps, dest
        );
        Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|e| e.to_string())?
    };

    if !status.success() {
        let _ = fs::remove_file(&archive_path);
        return Err(format!(
            "Failed to create archive at {}",
            archive_path.display()
        ));
    }

    Ok(archive_path.to_string_lossy().to_string())
}

fn apply_batch_rename_operations(operations: Vec<BatchRenameOperation>) -> Result<(), String> {
    let filtered_operations: Vec<BatchRenameOperation> = operations
        .into_iter()
        .filter(|operation| operation.old_path != operation.new_path)
        .collect();

    if filtered_operations.is_empty() {
        return Ok(());
    }

    let old_paths: HashSet<PathBuf> = filtered_operations
        .iter()
        .map(|operation| PathBuf::from(&operation.old_path))
        .collect();
    let mut new_paths = HashSet::new();

    for operation in &filtered_operations {
        let old_path = Path::new(&operation.old_path);
        let new_path = Path::new(&operation.new_path);

        if !old_path.exists() {
            return Err(format!(
                "Source path does not exist: {}",
                old_path.display()
            ));
        }

        if !new_paths.insert(new_path.to_path_buf()) {
            return Err(format!(
                "Multiple items cannot be renamed to the same path: {}",
                new_path.display()
            ));
        }

        if new_path.exists() && !old_paths.contains(new_path) {
            return Err(format!(
                "Target path already exists: {}",
                new_path.display()
            ));
        }
    }

    let prepared_operations = filtered_operations
        .iter()
        .enumerate()
        .map(|(index, operation)| {
            let old_path = PathBuf::from(&operation.old_path);
            let new_path = PathBuf::from(&operation.new_path);
            let temp_path = get_temporary_rename_path(&old_path, index)?;

            Ok(PreparedBatchRenameOperation {
                old_path,
                new_path,
                temp_path,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    let mut moved_to_temp = 0usize;
    for operation in &prepared_operations {
        if let Err(error) = fs::rename(&operation.old_path, &operation.temp_path) {
            rollback_temp_renames(&prepared_operations[..moved_to_temp]);
            return Err(error.to_string());
        }

        moved_to_temp += 1;
    }

    let mut moved_to_target = 0usize;
    for operation in &prepared_operations {
        if let Err(error) = fs::rename(&operation.temp_path, &operation.new_path) {
            rollback_target_renames(&prepared_operations[..moved_to_target]);
            rollback_pending_temp_renames(&prepared_operations[moved_to_target..]);
            return Err(error.to_string());
        }

        moved_to_target += 1;
    }

    Ok(())
}

fn get_temporary_rename_path(path: &Path, index: usize) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Could not find parent directory for {}", path.display()))?;
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();

    for attempt in 0..1000usize {
        let candidate = parent.join(format!(
            ".__mycommander_batch_rename_{seed}_{index}_{attempt}"
        ));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Could not create a temporary rename path for {}",
        path.display()
    ))
}

fn rollback_temp_renames(operations: &[PreparedBatchRenameOperation]) {
    for operation in operations.iter().rev() {
        let _ = fs::rename(&operation.temp_path, &operation.old_path);
    }
}

fn rollback_target_renames(operations: &[PreparedBatchRenameOperation]) {
    for operation in operations.iter().rev() {
        let _ = fs::rename(&operation.new_path, &operation.old_path);
    }
}

fn rollback_pending_temp_renames(operations: &[PreparedBatchRenameOperation]) {
    for operation in operations.iter().rev() {
        let _ = fs::rename(&operation.temp_path, &operation.old_path);
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn get_dir_size_with_du(path: &str) -> Result<u64, String> {
    use std::process::Command;

    let output = Command::new("du")
        .arg("-sk")
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let size_kb = stdout
        .split_whitespace()
        .next()
        .ok_or_else(|| "Failed to parse `du` output".to_string())?
        .parse::<u64>()
        .map_err(|e| e.to_string())?;

    Ok(size_kb * 1024)
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

fn collapse_nested_paths(paths: Vec<String>) -> Vec<PathBuf> {
    let mut collapsed: Vec<PathBuf> = Vec::new();
    let mut candidates: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();

    candidates.sort_by(|a, b| {
        a.components()
            .count()
            .cmp(&b.components().count())
            .then_with(|| a.as_os_str().len().cmp(&b.as_os_str().len()))
    });

    for candidate in candidates {
        if collapsed
            .iter()
            .any(|existing| candidate == *existing || candidate.starts_with(existing))
        {
            continue;
        }

        collapsed.push(candidate);
    }

    collapsed
}

fn move_to_trash(path: &Path) -> Result<(), trash::Error> {
    #[cfg(target_os = "macos")]
    {
        let mut ctx = trash::TrashContext::new();
        // On macOS, avoiding Finder prevents metadata files like `.DS_Store`
        // from being recreated during the trash operation.
        ctx.set_delete_method(DeleteMethod::NsFileManager);
        return ctx.delete(path);
    }

    #[cfg(not(target_os = "macos"))]
    {
        trash::delete(path)
    }
}

fn copy_single_path(source: &Path, target_path: &str) -> Result<(), String> {
    let target = Path::new(target_path);

    if target.exists() && target.is_dir() {
        return copy_path_into_dir(source, target);
    }

    if target_path.ends_with(std::path::MAIN_SEPARATOR)
        || target_path.ends_with('/')
        || target_path.ends_with('\\')
    {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
        return copy_path_into_dir(source, target);
    }

    copy_path_to_destination(source, target)
}

fn copy_path_into_dir(source: &Path, target_dir: &Path) -> Result<(), String> {
    let file_name = source
        .file_name()
        .ok_or_else(|| format!("Could not determine file name for {}", source.display()))?;
    let destination = target_dir.join(file_name);

    copy_path_to_destination(source, &destination)
}

fn copy_path_to_destination(source: &Path, destination: &Path) -> Result<(), String> {
    let source_metadata = fs::metadata(source).map_err(|e| e.to_string())?;
    let source_link_metadata = fs::symlink_metadata(source).map_err(|e| e.to_string())?;
    let source_canonical = source.canonicalize().map_err(|e| e.to_string())?;

    if destination.exists() {
        let destination_canonical = destination.canonicalize().map_err(|e| e.to_string())?;
        if destination_canonical == source_canonical {
            return Err(format!(
                "Source and destination are the same: {}",
                source.display()
            ));
        }
    }

    if source_link_metadata.file_type().is_symlink() && source_metadata.is_dir() {
        return Err(format!(
            "Copying directory symlinks is not supported yet: {}",
            source.display()
        ));
    }

    if source_metadata.is_dir() {
        let normalized_destination = normalize_target_path(destination)?;
        if normalized_destination.starts_with(&source_canonical) {
            return Err(format!(
                "Cannot copy a directory into itself: {}",
                source.display()
            ));
        }

        copy_directory_recursive(source, destination)?;
        return Ok(());
    }

    copy_file_to_destination(source, destination)
}

fn copy_directory_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    use walkdir::WalkDir;

    fs::create_dir_all(destination).map_err(|e| e.to_string())?;

    for entry in WalkDir::new(source) {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let relative_path = entry_path.strip_prefix(source).map_err(|e| e.to_string())?;

        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let destination_path = destination.join(relative_path);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&destination_path).map_err(|e| e.to_string())?;
            continue;
        }

        if entry.file_type().is_symlink() {
            let metadata = fs::metadata(entry_path).map_err(|e| e.to_string())?;
            if metadata.is_dir() {
                return Err(format!(
                    "Copying directory symlinks is not supported yet: {}",
                    entry_path.display()
                ));
            }
        }

        copy_file_to_destination(entry_path, &destination_path)?;
    }

    Ok(())
}

fn copy_file_to_destination(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::copy(source, destination).map_err(|e| e.to_string())?;
    Ok(())
}

fn normalize_target_path(path: &Path) -> Result<PathBuf, String> {
    let mut existing_ancestor = path;
    let mut suffix: Vec<OsString> = Vec::new();

    while !existing_ancestor.exists() {
        let name = existing_ancestor
            .file_name()
            .ok_or_else(|| format!("Could not resolve destination path {}", path.display()))?;
        suffix.push(name.to_os_string());
        existing_ancestor = existing_ancestor
            .parent()
            .ok_or_else(|| format!("Could not resolve destination path {}", path.display()))?;
    }

    let mut resolved = existing_ancestor
        .canonicalize()
        .map_err(|e| e.to_string())?;

    for component in suffix.iter().rev() {
        resolved.push(component);
    }

    Ok(resolved)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn check_copy_conflicts(
    source_paths: Vec<String>,
    target_path: String,
) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let target = Path::new(&target_path);
        let mut conflicts = Vec::new();

        for source in &source_paths {
            let src = Path::new(source);
            let file_name = src
                .file_name()
                .ok_or_else(|| format!("Invalid path: {}", source))?;
            let destination = if target.is_dir() {
                target.join(file_name)
            } else {
                target.to_path_buf()
            };
            if destination.exists() {
                conflicts.push(file_name.to_string_lossy().to_string());
            }
        }

        Ok(conflicts)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn create_test_dir(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("mycommander_{name}_{suffix}"))
    }

    #[test]
    fn collapse_nested_removes_children() {
        let paths = vec!["/a".to_string(), "/a/b".to_string(), "/a/b/c".to_string()];
        let result = collapse_nested_paths(paths);
        assert_eq!(result, vec![PathBuf::from("/a")]);
    }

    #[test]
    fn collapse_nested_keeps_siblings() {
        let paths = vec!["/a".to_string(), "/b".to_string(), "/c".to_string()];
        let result = collapse_nested_paths(paths);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn collapse_nested_handles_overlapping_prefixes() {
        // /app should NOT collapse /a/b because /app does not start with /a/
        let paths = vec!["/a".to_string(), "/app".to_string()];
        let result = collapse_nested_paths(paths);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn collapse_nested_removes_exact_duplicate() {
        let paths = vec!["/a/b".to_string(), "/a/b".to_string()];
        let result = collapse_nested_paths(paths);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], PathBuf::from("/a/b"));
    }

    #[test]
    fn collapse_nested_empty_vec() {
        let result = collapse_nested_paths(vec![]);
        assert!(result.is_empty());
    }

    #[test]
    fn hidden_entry_dot_prefix() {
        let dir = std::env::temp_dir();
        let metadata = fs::metadata(&dir).unwrap();
        assert!(is_hidden_entry(".hidden", &metadata));
    }

    #[test]
    fn hidden_entry_normal_file() {
        let dir = std::env::temp_dir();
        let metadata = fs::metadata(&dir).unwrap();
        assert!(!is_hidden_entry("visible.txt", &metadata));
    }

    #[test]
    fn hidden_entry_dot_and_dotdot_are_not_hidden() {
        let dir = std::env::temp_dir();
        let metadata = fs::metadata(&dir).unwrap();
        assert!(!is_hidden_entry(".", &metadata));
        assert!(!is_hidden_entry("..", &metadata));
    }

    #[test]
    fn unique_extraction_dir_base_name() {
        let tmp = std::env::temp_dir().join("test_extract_unique");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let archive = tmp.join("data.zip");
        fs::write(&archive, b"").unwrap();

        let result = get_unique_extraction_dir(&archive).unwrap();
        assert_eq!(result, tmp.join("data"));

        // Clean up
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_extraction_dir_increments_suffix() {
        let tmp = std::env::temp_dir().join("test_extract_suffix");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let archive = tmp.join("data.zip");
        fs::write(&archive, b"").unwrap();

        // Create "data" dir so the first name is taken
        fs::create_dir_all(tmp.join("data")).unwrap();

        let result = get_unique_extraction_dir(&archive).unwrap();
        assert_eq!(result, tmp.join("data 2"));

        // Clean up
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_archive_path_base_name() {
        let tmp = std::env::temp_dir().join("test_archive_unique");
        let source = tmp.join("data");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&source).unwrap();

        let result = get_unique_archive_path(&source).unwrap();
        assert_eq!(result, tmp.join("data.zip"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unique_archive_path_increments_suffix() {
        let tmp = std::env::temp_dir().join("test_archive_suffix");
        let source = tmp.join("data");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&source).unwrap();
        fs::write(tmp.join("data.zip"), b"").unwrap();

        let result = get_unique_archive_path(&source).unwrap();
        assert_eq!(result, tmp.join("data 2.zip"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn create_zip_archive_rejects_non_directory() {
        let tmp = std::env::temp_dir().join("test_create_zip_file.txt");
        let _ = fs::remove_file(&tmp);
        fs::write(&tmp, b"hello").unwrap();

        let result = create_zip_archive(tmp.to_str().unwrap());
        assert!(result.is_err());

        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn compute_path_size_for_single_file() {
        let tmp = std::env::temp_dir().join("test_size_file");
        let _ = fs::remove_file(&tmp);

        let content = b"hello world";
        fs::write(&tmp, content).unwrap();

        let size = compute_path_size(tmp.to_str().unwrap()).unwrap();
        assert_eq!(size, content.len() as u64);

        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn compute_path_size_nonexistent_path() {
        let result = compute_path_size("/nonexistent/path/that/should/not/exist");
        assert!(result.is_err());
    }

    #[test]
    fn batch_rename_swaps_file_names_safely() {
        let tmp = create_test_dir("batch_swap");
        fs::create_dir_all(&tmp).unwrap();

        let a_path = tmp.join("a.txt");
        let b_path = tmp.join("b.txt");
        fs::write(&a_path, b"alpha").unwrap();
        fs::write(&b_path, b"beta").unwrap();

        apply_batch_rename_operations(vec![
            BatchRenameOperation {
                old_path: a_path.to_string_lossy().to_string(),
                new_path: b_path.to_string_lossy().to_string(),
            },
            BatchRenameOperation {
                old_path: b_path.to_string_lossy().to_string(),
                new_path: a_path.to_string_lossy().to_string(),
            },
        ])
        .unwrap();

        assert_eq!(fs::read(a_path).unwrap(), b"beta");
        assert_eq!(fs::read(b_path).unwrap(), b"alpha");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn batch_rename_rejects_existing_target_outside_batch() {
        let tmp = create_test_dir("batch_conflict");
        fs::create_dir_all(&tmp).unwrap();

        let a_path = tmp.join("a.txt");
        let c_path = tmp.join("c.txt");
        fs::write(&a_path, b"alpha").unwrap();
        fs::write(&c_path, b"charlie").unwrap();

        let result = apply_batch_rename_operations(vec![BatchRenameOperation {
            old_path: a_path.to_string_lossy().to_string(),
            new_path: c_path.to_string_lossy().to_string(),
        }]);

        assert!(result.is_err());

        let _ = fs::remove_dir_all(&tmp);
    }
}
