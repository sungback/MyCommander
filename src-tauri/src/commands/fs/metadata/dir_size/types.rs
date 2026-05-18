use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeEstimate {
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeScanResult {
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
    pub error_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeProgress {
    pub scan_id: String,
    pub path: String,
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
    pub completed: bool,
}

#[derive(Clone, Default)]
pub struct DirSizeScanState {
    active_scans: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl DirSizeScanState {
    pub(super) fn begin(&self, scan_id: &str) -> Result<Arc<AtomicBool>, String> {
        let mut active_scans = self
            .active_scans
            .lock()
            .map_err(|_| "Directory size scan state is unavailable".to_string())?;

        if active_scans.contains_key(scan_id) {
            return Err(format!("Directory size scan `{scan_id}` is already active"));
        }

        let cancel_flag = Arc::new(AtomicBool::new(false));
        active_scans.insert(scan_id.to_string(), cancel_flag.clone());
        Ok(cancel_flag)
    }

    pub(super) fn end(&self, scan_id: &str) {
        if let Ok(mut active_scans) = self.active_scans.lock() {
            active_scans.remove(scan_id);
        }
    }

    pub fn cancel(&self, scan_id: &str) -> bool {
        self.active_scans
            .lock()
            .ok()
            .and_then(|active_scans| active_scans.get(scan_id).cloned())
            .is_some_and(|cancel_flag| {
                cancel_flag.store(true, Ordering::SeqCst);
                true
            })
    }
}
