use super::shared::{is_operation_cancelled, ProgressPayload};
use serde::Deserialize;
use std::collections::HashSet;
use std::ffi::OsString;
use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Emitter;

#[cfg(target_os = "macos")]
use trash::macos::{DeleteMethod, TrashContextExtMacos};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BatchRenameOperation {
    pub(crate) old_path: String,
    pub(crate) new_path: String,
}

#[derive(Clone)]
struct PreparedBatchRenameOperation {
    old_path: PathBuf,
    new_path: PathBuf,
    temp_path: PathBuf,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_file(path: String) -> Result<(), String> {
    create_new_file(Path::new(&path))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_files(
    app: tauri::AppHandle,
    paths: Vec<String>,
    permanent: bool,
) -> Result<(), String> {
    delete_files_with_cancel(app, paths, permanent, None).await
}

pub async fn delete_files_with_cancel(
    app: tauri::AppHandle,
    paths: Vec<String>,
    permanent: bool,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<(), String> {
    delete_files_with_cancel_and_progress(paths, permanent, cancel_flag, move |payload| {
        let _ = app.emit("fs-progress", payload);
    })
    .await
}

pub async fn delete_files_with_cancel_and_progress<F>(
    paths: Vec<String>,
    permanent: bool,
    cancel_flag: Option<Arc<AtomicBool>>,
    emit_progress: F,
) -> Result<(), String>
where
    F: Fn(ProgressPayload) + Send + 'static,
{
    let targets = collect_delete_progress_targets(paths);

    tokio::task::spawn_blocking(move || {
        delete_files_blocking(targets, permanent, cancel_flag, emit_progress)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let old_path = PathBuf::from(old_path);
    let new_path = PathBuf::from(new_path);

    tokio::task::spawn_blocking(move || rename_file_without_overwrite(&old_path, &new_path))
        .await
        .map_err(|e| e.to_string())?
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
    keep_both: Option<bool>,
) -> Result<Vec<String>, String> {
    copy_files_with_cancel(app, source_paths, target_path, keep_both, None).await
}

pub async fn copy_files_with_cancel(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_path: String,
    keep_both: Option<bool>,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<Vec<String>, String> {
    copy_files_with_cancel_and_progress(
        source_paths,
        target_path,
        keep_both,
        cancel_flag,
        move |payload| {
            let _ = app.emit("fs-progress", payload);
        },
    )
    .await
}

pub async fn copy_files_with_cancel_and_progress<F>(
    source_paths: Vec<String>,
    target_path: String,
    keep_both: Option<bool>,
    cancel_flag: Option<Arc<AtomicBool>>,
    emit_progress: F,
) -> Result<Vec<String>, String>
where
    F: Fn(ProgressPayload) + Send + 'static,
{
    let keep_both = keep_both.unwrap_or(false);
    let total = source_paths.len() as u64;
    tokio::task::spawn_blocking(move || {
        if source_paths.is_empty() {
            return Ok(vec![]);
        }

        if is_operation_cancelled(cancel_flag.as_deref()) {
            return Err("Operation cancelled.".to_string());
        }

        if source_paths.len() == 1 {
            let file_name = Path::new(&source_paths[0])
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| source_paths[0].clone());
            let saved = copy_single_path(Path::new(&source_paths[0]), &target_path, keep_both)?;
            emit_progress(ProgressPayload {
                operation: "copy".to_string(),
                current: 1,
                total,
                current_file: file_name,
                unit: "items".to_string(),
            });
            return Ok(vec![saved]);
        }

        let target_root = Path::new(&target_path);
        fs::create_dir_all(target_root).map_err(|e| e.to_string())?;
        if !target_root.is_dir() {
            return Err(format!("{target_path} is not a directory"));
        }

        let mut saved_names = Vec::with_capacity(source_paths.len());
        for (index, source) in source_paths.iter().enumerate() {
            if is_operation_cancelled(cancel_flag.as_deref()) {
                return Err("Operation cancelled.".to_string());
            }
            let file_name = Path::new(source)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| source.clone());
            let saved = copy_path_into_dir(Path::new(source), target_root, keep_both)?;
            saved_names.push(saved);
            emit_progress(ProgressPayload {
                operation: "copy".to_string(),
                current: (index + 1) as u64,
                total,
                current_file: file_name,
                unit: "items".to_string(),
            });
        }
        Ok(saved_names)
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
    move_files_with_cancel(app, source_paths, target_dir, None).await
}

pub async fn move_files_with_cancel(
    app: tauri::AppHandle,
    source_paths: Vec<String>,
    target_dir: String,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<(), String> {
    move_files_with_cancel_and_progress(source_paths, target_dir, cancel_flag, move |payload| {
        let _ = app.emit("fs-progress", payload);
    })
    .await
}

pub async fn move_files_with_cancel_and_progress<F>(
    source_paths: Vec<String>,
    target_dir: String,
    cancel_flag: Option<Arc<AtomicBool>>,
    emit_progress: F,
) -> Result<(), String>
where
    F: Fn(ProgressPayload) + Send + 'static,
{
    let total = source_paths.len() as u64;
    let multiple_sources = source_paths.len() > 1;

    for (index, path) in source_paths.iter().enumerate() {
        if is_operation_cancelled(cancel_flag.as_deref()) {
            return Err("Operation cancelled.".to_string());
        }
        let src = Path::new(path);
        let file_name = src
            .file_name()
            .ok_or_else(|| format!("Could not determine file name for {}", src.display()))?;
        let file_name_str = file_name.to_string_lossy().to_string();
        let dest = resolve_move_destination(src, &target_dir, multiple_sources)?;

        ensure_move_destination_valid(src, &dest, &file_name_str)?;

        fs::rename(src, &dest).map_err(|e| e.to_string())?;
        emit_progress(ProgressPayload {
            operation: "move".to_string(),
            current: (index + 1) as u64,
            total,
            current_file: file_name_str,
            unit: "items".to_string(),
        });
    }
    Ok(())
}

fn resolve_move_destination(
    source: &Path,
    target_path: &str,
    multiple_sources: bool,
) -> Result<PathBuf, String> {
    let target = Path::new(target_path);

    if target.exists() && target.is_dir() {
        let file_name = source
            .file_name()
            .ok_or_else(|| format!("Could not determine file name for {}", source.display()))?;
        return Ok(target.join(file_name));
    }

    if multiple_sources {
        return Err(format!(
            "Move target must be an existing folder when moving multiple items: {}",
            target.display()
        ));
    }

    let parent = target.parent().ok_or_else(|| {
        format!(
            "Could not determine target parent directory for {}",
            target.display()
        )
    })?;
    if !parent.exists() {
        return Err(format!(
            "Target parent directory does not exist: {}",
            parent.display()
        ));
    }

    Ok(target.to_path_buf())
}

fn ensure_move_destination_valid(
    source: &Path,
    destination: &Path,
    file_name_str: &str,
) -> Result<(), String> {
    if source == destination {
        return Err(format!("이미 같은 위치에 있습니다: {file_name_str}"));
    }

    let source_canonical = source.canonicalize().map_err(|e| e.to_string())?;
    if destination.exists() {
        let destination_canonical = destination.canonicalize().map_err(|e| e.to_string())?;
        if source_canonical == destination_canonical {
            return Err(format!("이미 같은 위치에 있습니다: {file_name_str}"));
        }

        return Err(format!(
            "Target path already exists: {}",
            destination.display()
        ));
    }

    if source.is_dir() {
        let normalized_destination = normalize_target_path(destination)?;
        if normalized_destination.starts_with(&source_canonical) {
            return Err(format!(
                "Cannot move a directory into itself: {}",
                source.display()
            ));
        }
    }

    Ok(())
}

fn create_new_file(path: &Path) -> Result<(), String> {
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map(|_| ())
        .map_err(|error| {
            if error.kind() == ErrorKind::AlreadyExists {
                format!("Target path already exists: {}", path.display())
            } else {
                error.to_string()
            }
        })
}

fn rename_file_without_overwrite(old_path: &Path, new_path: &Path) -> Result<(), String> {
    fs::symlink_metadata(old_path).map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            format!("Source path does not exist: {}", old_path.display())
        } else {
            error.to_string()
        }
    })?;

    match fs::symlink_metadata(new_path) {
        Ok(_) => {
            if !paths_refer_to_same_entry(old_path, new_path) {
                return Err(format!(
                    "Target path already exists: {}",
                    new_path.display()
                ));
            }
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }

    if old_path == new_path {
        return Ok(());
    }

    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

fn paths_refer_to_same_entry(left: &Path, right: &Path) -> bool {
    left == right
        || left
            .canonicalize()
            .ok()
            .zip(right.canonicalize().ok())
            .is_some_and(|(left, right)| left == right)
}

pub(crate) fn apply_batch_rename_operations(
    operations: Vec<BatchRenameOperation>,
) -> Result<(), String> {
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

    for (i, operation) in prepared_operations.iter().enumerate() {
        if let Err(error) = fs::rename(&operation.old_path, &operation.temp_path) {
            rollback_temp_renames(&prepared_operations[..i]);
            return Err(error.to_string());
        }
    }

    for (i, operation) in prepared_operations.iter().enumerate() {
        if let Err(error) = fs::rename(&operation.temp_path, &operation.new_path) {
            rollback_target_renames(&prepared_operations[..i]);
            rollback_pending_temp_renames(&prepared_operations[i..]);
            return Err(error.to_string());
        }
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

pub(crate) fn collapse_nested_paths(paths: Vec<String>) -> Vec<PathBuf> {
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

pub(crate) fn collect_delete_progress_targets(paths: Vec<String>) -> Vec<PathBuf> {
    collapse_nested_paths(paths)
}

fn delete_files_blocking<F>(
    targets: Vec<PathBuf>,
    permanent: bool,
    cancel_flag: Option<Arc<AtomicBool>>,
    emit_progress: F,
) -> Result<(), String>
where
    F: Fn(ProgressPayload),
{
    if targets.is_empty() {
        return Ok(());
    }

    let total = targets.len() as u64;
    emit_delete_progress(&emit_progress, 0, total, "Preparing...");

    for (index, path) in targets.iter().enumerate() {
        if is_operation_cancelled(cancel_flag.as_deref()) {
            return Err("Operation cancelled.".to_string());
        }
        let current_file = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| path.to_string_lossy().to_string());

        if permanent {
            if path.is_dir() {
                fs::remove_dir_all(path).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(path).map_err(|e| e.to_string())?;
            }
        } else {
            move_to_trash(path).map_err(|e| e.to_string())?;
        }

        emit_delete_progress(&emit_progress, index as u64 + 1, total, &current_file);
    }

    Ok(())
}

fn emit_delete_progress<F>(emit_progress: &F, current: u64, total: u64, current_file: &str)
where
    F: Fn(ProgressPayload),
{
    emit_progress(ProgressPayload {
        operation: "delete".to_string(),
        current,
        total,
        current_file: current_file.to_string(),
        unit: "items".to_string(),
    });
}

fn move_to_trash(path: &Path) -> Result<(), trash::Error> {
    #[cfg(target_os = "macos")]
    {
        let mut ctx = trash::TrashContext::new();
        ctx.set_delete_method(DeleteMethod::NsFileManager);
        ctx.delete(path)
    }

    #[cfg(not(target_os = "macos"))]
    {
        trash::delete(path)
    }
}

fn copy_single_path(source: &Path, target_path: &str, keep_both: bool) -> Result<String, String> {
    let target = Path::new(target_path);

    if target.exists() && target.is_dir() {
        return copy_path_into_dir(source, target, keep_both);
    }

    if target_path.ends_with(std::path::MAIN_SEPARATOR)
        || target_path.ends_with('/')
        || target_path.ends_with('\\')
    {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
        return copy_path_into_dir(source, target, keep_both);
    }

    copy_path_to_destination(source, target)?;
    Ok(target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default())
}

fn make_copy_name(source: &Path, target_dir: &Path) -> PathBuf {
    let file_name = source
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let (stem, ext_with_dot) = if source.is_dir() {
        (file_name.as_str().to_string(), String::new())
    } else {
        match source.extension() {
            Some(ext) => {
                let ext_str = ext.to_string_lossy().to_string();
                let stem_str = source
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                (stem_str, format!(".{ext_str}"))
            }
            None => (file_name.clone(), String::new()),
        }
    };

    let base_stem = {
        let copy_n_re = regex::Regex::new(r"^(.*) copy(?: (\d+))?$").unwrap();
        if let Some(caps) = copy_n_re.captures(&stem) {
            caps.get(1)
                .map(|m| m.as_str().to_string())
                .unwrap_or(stem.clone())
        } else {
            stem.clone()
        }
    };

    let first_candidate = target_dir.join(format!("{base_stem} copy{ext_with_dot}"));
    if !first_candidate.exists() {
        return first_candidate;
    }
    let mut n = 2u32;
    loop {
        let candidate = target_dir.join(format!("{base_stem} copy {n}{ext_with_dot}"));
        if !candidate.exists() {
            return candidate;
        }
        n += 1;
    }
}

fn copy_path_into_dir(source: &Path, target_dir: &Path, keep_both: bool) -> Result<String, String> {
    let file_name = source
        .file_name()
        .ok_or_else(|| format!("Could not determine file name for {}", source.display()))?;

    let same_folder = source.parent().map(|p| p == target_dir).unwrap_or(false);

    let destination = if same_folder || (keep_both && target_dir.join(file_name).exists()) {
        make_copy_name(source, target_dir)
    } else {
        target_dir.join(file_name)
    };

    let saved_name = destination
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    copy_path_to_destination(source, &destination)?;
    Ok(saved_name)
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
                .ok_or_else(|| format!("Invalid path: {source}"))?;
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
