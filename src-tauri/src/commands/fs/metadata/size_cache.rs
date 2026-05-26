use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[path = "size_cache/snapshot.rs"]
mod snapshot;
#[path = "size_cache/storage.rs"]
mod storage;

use snapshot::{build_load_result, is_stable_update, prune_snapshot};
use storage::{cache_file_path, read_snapshot_from_path, write_snapshot_to_path};

const CACHE_VERSION: u8 = 2;
const CACHE_FILE_NAME: &str = "size-cache-v2.json";
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
            if path.is_empty() || !is_stable_update(&entry) {
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

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::{
        snapshot::{build_load_result, empty_snapshot, parse_snapshot, prune_snapshot},
        storage::write_snapshot_to_path,
        DirectorySizeCacheEntry, DirectorySizeCacheSnapshot, CACHE_VERSION,
    };
    use std::collections::HashMap;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn parse_snapshot_drops_unstable_or_empty_entries() {
        let snapshot = parse_snapshot(
            r#"{
              "version": 2,
              "entries": {
                "/exact": {
                  "size": 10,
                  "status": "exact",
                  "scannedAt": 100,
                  "lastUsedAt": 100
                },
                "/calculating": {
                  "size": 20,
                  "status": "calculating",
                  "scannedAt": 100,
                  "lastUsedAt": 100
                },
                "": {
                  "size": 30,
                  "status": "exact",
                  "scannedAt": 100,
                  "lastUsedAt": 100
                }
              }
            }"#,
        )
        .unwrap();

        assert_eq!(snapshot.version, CACHE_VERSION);
        assert_eq!(snapshot.entries.len(), 1);
        assert!(snapshot.entries.contains_key("/exact"));
    }

    #[test]
    fn parse_snapshot_drops_partial_zero_entries() {
        let snapshot = parse_snapshot(
            r#"{
              "version": 2,
              "entries": {
                "/partial-zero": {
                  "size": 0,
                  "status": "partial",
                  "scannedAt": 100,
                  "lastUsedAt": 100
                },
                "/exact-zero": {
                  "size": 0,
                  "status": "exact",
                  "scannedAt": 100,
                  "lastUsedAt": 100
                }
              }
            }"#,
        )
        .unwrap();

        assert!(!snapshot.entries.contains_key("/partial-zero"));
        assert!(snapshot.entries.contains_key("/exact-zero"));
    }

    #[test]
    fn parse_snapshot_drops_entries_from_old_cache_versions() {
        let snapshot = parse_snapshot(
            r#"{
              "version": 0,
              "entries": {
                "/system": {
                  "size": 9007199254740992,
                  "status": "partial",
                  "scannedAt": 100,
                  "lastUsedAt": 100
                }
              }
            }"#,
        )
        .unwrap();

        assert_eq!(snapshot.version, CACHE_VERSION);
        assert!(snapshot.entries.is_empty());
    }

    #[test]
    fn load_result_marks_exact_and_estimates_stale_by_ttl() {
        let now_ms = 1_000_000_000;
        let mut snapshot = empty_snapshot();
        snapshot.entries.insert(
            "/fresh-exact".to_string(),
            entry(1, "exact", now_ms - 1_000),
        );
        snapshot.entries.insert(
            "/stale-exact".to_string(),
            entry(1, "exact", now_ms - 8 * 24 * 60 * 60 * 1000),
        );
        snapshot.entries.insert(
            "/stale-estimate".to_string(),
            entry(1, "estimated", now_ms - 2 * 24 * 60 * 60 * 1000),
        );

        let result = build_load_result(snapshot, now_ms, 10);

        let fresh = result
            .entries
            .iter()
            .find(|entry| entry.path == "/fresh-exact")
            .unwrap();
        let stale_exact = result
            .entries
            .iter()
            .find(|entry| entry.path == "/stale-exact")
            .unwrap();
        let stale_estimate = result
            .entries
            .iter()
            .find(|entry| entry.path == "/stale-estimate")
            .unwrap();

        assert!(!fresh.is_stale);
        assert!(stale_exact.is_stale);
        assert!(stale_estimate.is_stale);
    }

    #[test]
    fn prune_snapshot_keeps_most_recently_used_entries() {
        let mut snapshot = DirectorySizeCacheSnapshot {
            version: CACHE_VERSION,
            entries: HashMap::from([
                ("/old".to_string(), entry(1, "exact", 100)),
                ("/middle".to_string(), entry(2, "exact", 200)),
                ("/new".to_string(), entry(3, "exact", 300)),
            ]),
        };

        prune_snapshot(&mut snapshot, 2);

        assert!(!snapshot.entries.contains_key("/old"));
        assert!(snapshot.entries.contains_key("/middle"));
        assert!(snapshot.entries.contains_key("/new"));
    }

    #[test]
    fn write_snapshot_to_path_creates_parent_and_roundtrips_json() {
        let root = make_temp_dir("size-cache-write");
        let file_path = root.join("nested").join("size-cache-v2.json");
        let mut snapshot = empty_snapshot();
        snapshot
            .entries
            .insert("/dir".to_string(), entry(123, "partial", 456));

        write_snapshot_to_path(&file_path, &snapshot).unwrap();
        let content = fs::read_to_string(&file_path).unwrap();
        let parsed = parse_snapshot(&content).unwrap();

        assert_eq!(parsed.entries.get("/dir").unwrap().size, 123);

        fs::remove_dir_all(root).unwrap();
    }

    fn entry(size: u64, status: &str, timestamp: u64) -> DirectorySizeCacheEntry {
        DirectorySizeCacheEntry {
            size,
            status: status.to_string(),
            scanned_at: timestamp,
            last_used_at: timestamp,
        }
    }

    fn make_temp_dir(label: &str) -> std::path::PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("mycommander-{label}-{id}"));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
