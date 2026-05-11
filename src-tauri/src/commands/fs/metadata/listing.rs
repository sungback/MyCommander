use crate::commands::path_display::path_to_display_string;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[cfg(target_os = "macos")]
use std::os::macos::fs::MetadataExt;

#[derive(Serialize)]
pub struct FileEntry {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) kind: String,
    pub(crate) size: Option<u64>,
    #[serde(rename = "lastModified")]
    pub(crate) last_modified: Option<u64>,
    #[serde(rename = "isHidden")]
    pub(crate) is_hidden: bool,
}

pub async fn list_directory(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.is_dir() {
        return Err(format!("{path} is not a directory"));
    }

    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();

    if let Some(parent) = dir_path.parent() {
        files.push(FileEntry {
            name: "..".to_string(),
            path: path_to_display_string(parent),
            kind: "directory".to_string(),
            size: None,
            last_modified: None,
            is_hidden: false,
        });
    }

    for entry in entries.flatten() {
        let metadata = entry.metadata().map_err(|e| e.to_string());
        let file_name = entry.file_name().to_string_lossy().to_string();
        let file_path = path_to_display_string(&entry.path());

        if let Ok(meta) = metadata {
            let is_hidden = is_hidden_entry(&file_name, &meta);

            if is_hidden && !show_hidden {
                continue;
            }

            files.push(FileEntry {
                name: file_name,
                path: file_path,
                kind: entry_kind(&meta),
                size: if meta.is_dir() {
                    None
                } else {
                    Some(meta.len())
                },
                last_modified: last_modified_ms(&meta),
                is_hidden,
            });
        }
    }

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

pub(crate) fn is_hidden_entry(file_name: &str, metadata: &fs::Metadata) -> bool {
    if file_name == "." || file_name == ".." {
        return false;
    }

    if file_name.starts_with('.') {
        return true;
    }

    #[cfg(target_os = "macos")]
    {
        const UF_HIDDEN: u32 = 0x0000_8000;
        metadata.st_flags() & UF_HIDDEN != 0
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = metadata;
        false
    }
}

fn entry_kind(meta: &fs::Metadata) -> String {
    if meta.is_dir() {
        "directory".to_string()
    } else if meta.is_symlink() {
        "symlink".to_string()
    } else {
        "file".to_string()
    }
}

fn last_modified_ms(meta: &fs::Metadata) -> Option<u64> {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}
