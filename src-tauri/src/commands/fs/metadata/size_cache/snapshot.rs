use std::collections::HashMap;

use super::{
    DirectorySizeCacheEntry, DirectorySizeCacheEntryUpdate, DirectorySizeCacheLoadResult,
    DirectorySizeCacheLoadedEntry, DirectorySizeCacheSnapshot, CACHE_VERSION, ESTIMATE_TTL_MS,
    EXACT_TTL_MS,
};

pub(super) fn parse_snapshot(
    content: &str,
) -> Result<DirectorySizeCacheSnapshot, serde_json::Error> {
    let mut snapshot: DirectorySizeCacheSnapshot = serde_json::from_str(content)?;
    if snapshot.version != CACHE_VERSION {
        return Ok(empty_snapshot());
    }

    sanitize_snapshot(&mut snapshot);
    Ok(snapshot)
}

pub(super) fn sanitize_snapshot(snapshot: &mut DirectorySizeCacheSnapshot) {
    snapshot.version = CACHE_VERSION;
    snapshot
        .entries
        .retain(|path, entry| !path.trim().is_empty() && is_stable_entry(entry));
}

pub(super) fn empty_snapshot() -> DirectorySizeCacheSnapshot {
    DirectorySizeCacheSnapshot {
        version: CACHE_VERSION,
        entries: HashMap::new(),
    }
}

pub(super) fn build_load_result(
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

pub(super) fn prune_snapshot(snapshot: &mut DirectorySizeCacheSnapshot, max_entries: usize) {
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

fn is_stable_entry(entry: &DirectorySizeCacheEntry) -> bool {
    is_stable_status(&entry.status) && !(entry.status == "partial" && entry.size == 0)
}

pub(super) fn is_stable_update(entry: &DirectorySizeCacheEntryUpdate) -> bool {
    is_stable_status(&entry.status) && !(entry.status == "partial" && entry.size == 0)
}
