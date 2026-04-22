use super::super::fs as fs_api;
use super::execution::{
    build_retry_submission, emit_job_update, public_records, schedule_next_job,
};
use super::persistence::{hydrate_job_engine_state, now_ms, persist_job_engine_state};
use super::state::{keep_active_jobs_only, InternalJobRecord};
use super::{JobEngineState, JobKind, JobProgress, JobRecord, JobStatus, JobSubmission};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command(rename_all = "snake_case")]
pub fn submit_job(
    app: AppHandle,
    state: State<'_, JobEngineState>,
    job: JobSubmission,
) -> Result<JobRecord, String> {
    let record = {
        let mut inner = state
            .inner
            .lock()
            .map_err(|_| "Failed to lock job engine state".to_string())?;
        hydrate_job_engine_state(&app, &mut inner)?;
        inner.next_id += 1;
        let now = now_ms();
        let id = format!("job-{}", inner.next_id);
        let record = JobRecord {
            id: id.clone(),
            kind: job.kind(),
            status: JobStatus::Queued,
            created_at: now,
            updated_at: now,
            progress: JobProgress::default(),
            error: None,
            result: None,
        };
        inner.queue.push_back(id.clone());
        inner.jobs.insert(
            id.clone(),
            InternalJobRecord {
                record: record.clone(),
                submission: job,
            },
        );
        inner
            .cancel_flags
            .insert(id, Arc::new(AtomicBool::new(false)));
        persist_job_engine_state(&app, &inner)?;
        record
    };

    emit_job_update(&app, &record);
    schedule_next_job(app, state.inner.clone());
    Ok(record)
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_jobs(
    app: AppHandle,
    state: State<'_, JobEngineState>,
) -> Result<Vec<JobRecord>, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Failed to lock job engine state".to_string())?;
    hydrate_job_engine_state(&app, &mut inner)?;
    Ok(public_records(&inner))
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_finished_jobs(app: AppHandle, state: State<'_, JobEngineState>) -> Result<(), String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Failed to lock job engine state".to_string())?;
    hydrate_job_engine_state(&app, &mut inner)?;
    keep_active_jobs_only(&mut inner);
    let active_job_ids = inner
        .jobs
        .keys()
        .cloned()
        .collect::<std::collections::HashSet<String>>();
    inner
        .cancel_flags
        .retain(|job_id, _| active_job_ids.contains(job_id));
    persist_job_engine_state(&app, &inner)?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn retry_job(
    app: AppHandle,
    state: State<'_, JobEngineState>,
    job_id: String,
) -> Result<JobRecord, String> {
    let submission = {
        let mut inner = state
            .inner
            .lock()
            .map_err(|_| "Failed to lock job engine state".to_string())?;
        hydrate_job_engine_state(&app, &mut inner)?;
        let Some(job) = inner.jobs.get(&job_id) else {
            return Err("Job not found".to_string());
        };

        if matches!(job.record.status, JobStatus::Queued | JobStatus::Running) {
            return Err("Only finished jobs can be retried".to_string());
        }

        build_retry_submission(job)?
    };

    submit_job(app, state, submission)
}

#[tauri::command(rename_all = "snake_case")]
pub fn cancel_job(
    app: AppHandle,
    state: State<'_, JobEngineState>,
    job_id: String,
) -> Result<JobRecord, String> {
    let queued_cancelled = {
        let mut inner = state
            .inner
            .lock()
            .map_err(|_| "Failed to lock job engine state".to_string())?;
        hydrate_job_engine_state(&app, &mut inner)?;

        let is_queued = inner
            .jobs
            .get(&job_id)
            .is_some_and(|job| job.record.status == JobStatus::Queued);

        if is_queued {
            inner.queue = inner
                .queue
                .iter()
                .filter(|queued_id| queued_id.as_str() != job_id)
                .cloned()
                .collect::<std::collections::VecDeque<String>>();

            if let Some(job) = inner.jobs.get_mut(&job_id) {
                job.record.status = JobStatus::Cancelled;
                job.record.updated_at = now_ms();
                job.record.error = Some("Cancelled before start".to_string());
                let cloned = job.record.clone();
                inner.cancel_flags.remove(&job_id);
                persist_job_engine_state(&app, &inner)?;
                Some(cloned)
            } else {
                None
            }
        } else {
            None
        }
    };

    if let Some(record) = queued_cancelled {
        emit_job_update(&app, &record);
        return Ok(record);
    }

    {
        let inner = state
            .inner
            .lock()
            .map_err(|_| "Failed to lock job engine state".to_string())?;
        let Some(job) = inner.jobs.get(&job_id) else {
            return Err("Job not found".to_string());
        };

        if inner.active_job_id.as_deref() == Some(job_id.as_str()) {
            if let Some(cancel_flag) = inner.cancel_flags.get(&job_id) {
                cancel_flag.store(true, Ordering::SeqCst);
            }

            if job.record.kind == JobKind::Zip {
                fs_api::cancel_zip_operation()?;
            }

            return Ok(job.record.clone());
        }
    }

    Err("Only queued or active jobs can be cancelled.".to_string())
}
