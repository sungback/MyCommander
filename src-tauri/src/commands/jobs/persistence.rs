use super::state::{JobEngineInner, PersistedJobEngineState};
use super::JobStatus;
use std::fs;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub(crate) fn snapshot_persisted_state(inner: &JobEngineInner) -> PersistedJobEngineState {
    let mut jobs = inner.jobs.values().cloned().collect::<Vec<_>>();
    jobs.sort_by_key(|job| job.record.created_at);
    PersistedJobEngineState {
        next_id: inner.next_id,
        jobs,
    }
}

pub(crate) fn restore_job_engine_state(snapshot: PersistedJobEngineState) -> JobEngineInner {
    let mut inner = JobEngineInner {
        next_id: snapshot.next_id,
        active_job_id: None,
        queue: std::collections::VecDeque::new(),
        jobs: std::collections::HashMap::new(),
        cancel_flags: std::collections::HashMap::new(),
        hydrated: true,
    };

    for mut job in snapshot.jobs {
        if job.record.status == JobStatus::Running {
            job.record.status = JobStatus::Failed;
            job.record.error = Some("Interrupted by app restart before completion.".to_string());
            job.record.updated_at = now_ms();
        }

        if job.record.status == JobStatus::Queued {
            inner.queue.push_back(job.record.id.clone());
        }

        inner
            .cancel_flags
            .insert(job.record.id.clone(), Arc::new(AtomicBool::new(false)));
        inner.jobs.insert(job.record.id.clone(), job);
    }

    inner
}

fn persistence_file_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data dir: {error}"))?;
    Ok(app_dir.join("job-queue.json"))
}

pub(crate) fn persist_job_engine_state(
    app: &AppHandle,
    inner: &JobEngineInner,
) -> Result<(), String> {
    let file_path = persistence_file_path(app)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create job state dir: {error}"))?;
    }

    let snapshot = snapshot_persisted_state(inner);
    let content = serde_json::to_string_pretty(&snapshot)
        .map_err(|error| format!("Failed to encode job state: {error}"))?;
    fs::write(&file_path, content).map_err(|error| format!("Failed to write job state: {error}"))
}

pub(crate) fn hydrate_job_engine_state(
    app: &AppHandle,
    inner: &mut JobEngineInner,
) -> Result<(), String> {
    if inner.hydrated {
        return Ok(());
    }

    let file_path = persistence_file_path(app)?;
    if !file_path.exists() {
        inner.hydrated = true;
        return Ok(());
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|error| format!("Failed to read job state: {error}"))?;
    let snapshot: PersistedJobEngineState = serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse job state: {error}"))?;
    *inner = restore_job_engine_state(snapshot);
    Ok(())
}
