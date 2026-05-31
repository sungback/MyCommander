use super::{
    build_load_result, empty_snapshot, parse_snapshot, prune_snapshot, write_snapshot_to_path,
    DirectorySizeCacheEntry, DirectorySizeCacheSnapshot,
};
use std::collections::HashMap;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn parse_snapshot_drops_unstable_or_empty_entries() {
    let snapshot = parse_snapshot(
        r#"{
          "version": 1,
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

    assert_eq!(snapshot.version, 1);
    assert_eq!(snapshot.entries.len(), 1);
    assert!(snapshot.entries.contains_key("/exact"));
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
        version: 1,
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
    let file_path = root.join("nested").join("size-cache-v1.json");
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
