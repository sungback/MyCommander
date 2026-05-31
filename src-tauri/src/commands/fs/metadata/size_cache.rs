use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const CACHE_VERSION: u8 = 1;
const CACHE_FILE_NAME: &str = "size-cache-v1.json";
const DEFAULT_MAX_ENTRIES: usize = 10_000;
const EXACT_TTL_MS: u64 = 7 * 24 * 60 * 60 * 1000;
const ESTIMATE_TTL_MS: u64 = 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeCacheEntry {
    pub size: u64,
    pub status: String,
    pub scanned_at: u64,
    pub last_used_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeCacheSnapshot {
    pub version: u8,
    pub entries: HashMap<String, DirectorySizeCacheEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeCacheLoadedEntry {
    pub path: String,
    pub size: u64,
    pub status: String,
    pub scanned_at: u64,
    pub last_used_at: u64,
    pub is_stale: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeCacheLoadResult {
    pub version: u8,
    pub entries: Vec<DirectorySizeCacheLoadedEntry>,
    pub loaded_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeCacheEntryUpdate {
    pub path: String,
    pub size: u64,
    pub status: String,
    pub scanned_at: Option<u64>,
    pub last_used_at: Option<u64>,
}

pub async fn load_dir_size_cache(app: AppHandle) -> Result<DirectorySizeCacheLoadResult, String> {
    tokio::task::spawn_blocking(move || {
        let file_path = cache_file_path(&app)?;
        let now_ms = now_ms();
        let snapshot = read_snapshot_from_path(&file_path)?;
        Ok(build_load_result(snapshot, now_ms, DEFAULT_MAX_ENTRIES))
    })
    .await
    .map_err(|error| error.to_string())?
}

pub async fn upsert_dir_size_cache_entries(
    app: AppHandle,
    entries: Vec<DirectorySizeCacheEntryUpdate>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        if entries.is_empty() {
            return Ok(());
        }

        let file_path = cache_file_path(&app)?;
        let mut snapshot = read_snapshot_from_path(&file_path)?;
        let now_ms = now_ms();

        for entry in entries {
            let path = entry.path.trim();
            if path.is_empty() || !is_stable_status(&entry.status) {
                continue;
            }

            let scanned_at = entry.scanned_at.unwrap_or(now_ms);
            snapshot.entries.insert(
                path.to_string(),
                DirectorySizeCacheEntry {
                    size: entry.size,
                    status: entry.status,
                    scanned_at,
                    last_used_at: entry.last_used_at.unwrap_or(scanned_at),
                },
            );
        }

        prune_snapshot(&mut snapshot, DEFAULT_MAX_ENTRIES);
        write_snapshot_to_path(&file_path, &snapshot)
    })
    .await
    .map_err(|error| error.to_string())?
}

pub async fn delete_dir_size_cache_entries(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        if paths.is_empty() {
            return Ok(());
        }

        let file_path = cache_file_path(&app)?;
        let mut snapshot = read_snapshot_from_path(&file_path)?;
        let mut changed = false;

        for path in paths {
            if snapshot.entries.remove(path.trim()).is_some() {
                changed = true;
            }
        }

        if changed {
            write_snapshot_to_path(&file_path, &snapshot)?;
        }

        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn cache_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data dir: {error}"))?;
    Ok(app_dir.join(CACHE_FILE_NAME))
}

fn read_snapshot_from_path(file_path: &Path) -> Result<DirectorySizeCacheSnapshot, String> {
    if !file_path.exists() {
        return Ok(empty_snapshot());
    }

    let content = fs::read_to_string(file_path)
        .map_err(|error| format!("Failed to read directory size cache: {error}"))?;
    Ok(parse_snapshot(&content).unwrap_or_else(|_| empty_snapshot()))
}

fn parse_snapshot(content: &str) -> Result<DirectorySizeCacheSnapshot, serde_json::Error> {
    let mut snapshot: DirectorySizeCacheSnapshot = serde_json::from_str(content)?;
    sanitize_snapshot(&mut snapshot);
    Ok(snapshot)
}

fn sanitize_snapshot(snapshot: &mut DirectorySizeCacheSnapshot) {
    snapshot.version = CACHE_VERSION;
    snapshot
        .entries
        .retain(|path, entry| !path.trim().is_empty() && is_stable_status(&entry.status));
}

fn empty_snapshot() -> DirectorySizeCacheSnapshot {
    DirectorySizeCacheSnapshot {
        version: CACHE_VERSION,
        entries: HashMap::new(),
    }
}

fn build_load_result(
    mut snapshot: DirectorySizeCacheSnapshot,
    now_ms: u64,
    max_entries: usize,
) -> DirectorySizeCacheLoadResult {
    prune_snapshot(&mut snapshot, max_entries);

    let mut entries = snapshot
        .entries
        .into_iter()
        .map(|(path, entry)| DirectorySizeCacheLoadedEntry {
            is_stale: is_entry_stale(&entry, now_ms),
            path,
            size: entry.size,
            status: entry.status,
            scanned_at: entry.scanned_at,
            last_used_at: entry.last_used_at,
        })
        .collect::<Vec<_>>();

    entries.sort_by(|a, b| a.path.cmp(&b.path));

    DirectorySizeCacheLoadResult {
        version: CACHE_VERSION,
        entries,
        loaded_at: now_ms,
    }
}

fn prune_snapshot(snapshot: &mut DirectorySizeCacheSnapshot, max_entries: usize) {
    sanitize_snapshot(snapshot);

    if max_entries == 0 {
        snapshot.entries.clear();
        return;
    }

    if snapshot.entries.len() <= max_entries {
        return;
    }

    let mut entries_by_age = snapshot
        .entries
        .iter()
        .map(|(path, entry)| (path.clone(), entry.last_used_at))
        .collect::<Vec<_>>();
    entries_by_age.sort_by_key(|(_, last_used_at)| *last_used_at);

    let remove_count = snapshot.entries.len().saturating_sub(max_entries);
    for (path, _) in entries_by_age.into_iter().take(remove_count) {
        snapshot.entries.remove(&path);
    }
}

fn is_entry_stale(entry: &DirectorySizeCacheEntry, now_ms: u64) -> bool {
    let ttl = match entry.status.as_str() {
        "exact" => EXACT_TTL_MS,
        "estimated" | "partial" => ESTIMATE_TTL_MS,
        _ => return true,
    };

    match entry.scanned_at.checked_add(ttl) {
        Some(expires_at) => expires_at <= now_ms,
        None => true,
    }
}

fn is_stable_status(status: &str) -> bool {
    matches!(status, "exact" | "estimated" | "partial")
}

fn write_snapshot_to_path(
    file_path: &Path,
    snapshot: &DirectorySizeCacheSnapshot,
) -> Result<(), String> {
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create directory size cache dir: {error}"))?;
    }

    let content = serde_json::to_string_pretty(snapshot)
        .map_err(|error| format!("Failed to encode directory size cache: {error}"))?;
    let temp_path = file_path.with_extension("json.tmp");
    fs::write(&temp_path, content)
        .map_err(|error| format!("Failed to write directory size cache temp file: {error}"))?;

    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|error| format!("Failed to replace directory size cache: {error}"))?;
    }

    fs::rename(&temp_path, file_path)
        .map_err(|error| format!("Failed to finalize directory size cache: {error}"))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
#[path = "size_cache/tests.rs"]
mod tests;
