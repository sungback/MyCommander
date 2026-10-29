use super::paths::decode_zip_entry_name;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ZipEntryPreview {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub compressed_size: u64,
    pub modified: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ZipArchivePreview {
    pub file_name: String,
    pub file_size: u64,
    pub total_entries: usize,
    pub total_files: usize,
    pub total_dirs: usize,
    pub total_uncompressed_size: u64,
    pub total_compressed_size: u64,
    pub entries: Vec<ZipEntryPreview>,
    pub comment: Option<String>,
}

pub(crate) fn preview_zip_archive_sync(path: &str) -> Result<ZipArchivePreview, String> {
    let file_path = Path::new(path);
    if !file_path.is_file() {
        return Err(format!("{path} is not a file"));
    }

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path)
        .to_string();

    let file = fs::File::open(file_path).map_err(|e| format!("Failed to open file: {e}"))?;
    let file_size = file.metadata().map(|m| m.len()).unwrap_or(0);

    let mut zip =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {e}"))?;

    let comment = if !zip.comment().is_empty() {
        Some(String::from_utf8_lossy(zip.comment()).to_string())
    } else {
        None
    };

    let total_entries = zip.len();
    let mut total_files = 0;
    let mut total_dirs = 0;
    let mut total_uncompressed_size = 0u64;
    let mut total_compressed_size = 0u64;
    let mut entries = Vec::with_capacity(total_entries);

    for i in 0..total_entries {
        let entry = zip
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry #{i}: {e}"))?;
        let entry_name = decode_zip_entry_name(entry.name_raw(), entry.name());
        let is_dir = entry.is_dir() || entry_name.ends_with('/') || entry_name.ends_with('\\');
        let size = entry.size();
        let compressed_size = entry.compressed_size();

        if is_dir {
            total_dirs += 1;
        } else {
            total_files += 1;
            total_uncompressed_size = total_uncompressed_size.saturating_add(size);
            total_compressed_size = total_compressed_size.saturating_add(compressed_size);
        }

        let normalized_entry_name = entry_name.replace('\\', "/");
        let display_name = if is_dir {
            normalized_entry_name
                .trim_end_matches('/')
                .rsplit('/')
                .next()
                .unwrap_or(&normalized_entry_name)
                .to_string()
        } else {
            normalized_entry_name
                .rsplit('/')
                .next()
                .unwrap_or(&normalized_entry_name)
                .to_string()
        };

        let modified = entry.last_modified().map(|dt| {
            format!(
                "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
                dt.year(),
                dt.month(),
                dt.day(),
                dt.hour(),
                dt.minute(),
                dt.second()
            )
        });

        let entry_comment = if !entry.comment().is_empty() {
            Some(entry.comment().to_string())
        } else {
            None
        };

        entries.push(ZipEntryPreview {
            path: entry_name,
            name: display_name,
            is_dir,
            size,
            compressed_size,
            modified,
            comment: entry_comment,
        });
    }

    Ok(ZipArchivePreview {
        file_name,
        file_size,
        total_entries,
        total_files,
        total_dirs,
        total_uncompressed_size,
        total_compressed_size,
        entries,
        comment,
    })
}
