use super::super::fs as fs_api;
use super::persistence::{now_ms, persist_job_engine_state};
use super::state::JobEngineInner;
use super::{JobProgress, JobRecord, JobResult, JobStatus, JobSubmission};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[path = "execution_retry.rs"]
mod execution_retry;
#[path = "execution_runner.rs"]
mod execution_runner;

pub(crate) use execution_retry::build_retry_submission;

pub(crate) fn emit_job_update(app: &AppHandle, record: &JobRecord) {
    let _ = app.emit("job-updated", record);
}

fn emit_job_progress_update(
    app: &AppHandle,
    inner: &Arc<Mutex<JobEngineInner>>,
    job_id: &str,
    progress: &fs_api::ProgressPayload,
) {
    let record = {
        let mut state = match inner.lock() {
            Ok(state) => state,
            Err(_) => return,
        };

        let Some(job) = state.jobs.get_mut(job_id) else {
            return;
        };

        job.record.updated_at = now_ms();
        job.record.progress = JobProgress {
            current: progress.current,
            total: progress.total,
            current_file: progress.current_file.clone(),
            unit: progress.unit.clone(),
        };
        let cloned = job.record.clone();
        let _ = persist_job_engine_state(app, &state);
        cloned
    };

    emit_job_update(app, &record);
}

pub(crate) fn public_records(inner: &JobEngineInner) -> Vec<JobRecord> {
    let mut jobs = inner
        .jobs
        .values()
        .map(|job| job.record.clone())
        .collect::<Vec<JobRecord>>();
    jobs.sort_by_key(|job| job.created_at);
    jobs
}

async fn execute_job(
    app: &AppHandle,
    inner: &Arc<Mutex<JobEngineInner>>,
    job_id: &str,
    submission: &JobSubmission,
    cancel_flag: Arc<AtomicBool>,
) -> Result<JobResult, String> {
    execution_runner::execute_job(app, inner, job_id, submission, cancel_flag).await
}

pub(crate) fn schedule_next_job(app: AppHandle, inner: Arc<Mutex<JobEngineInner>>) {
    let next_job = {
        let mut state = match inner.lock() {
            Ok(state) => state,
            Err(_) => return,
        };

        if state.active_job_id.is_some() {
            return;
        }

        let next_id = match state.queue.pop_front() {
            Some(next_id) => next_id,
            None => return,
        };

        let now = now_ms();
        let cancel_flag = state
            .cancel_flags
            .entry(next_id.clone())
            .or_insert_with(|| Arc::new(AtomicBool::new(false)))
            .clone();
        cancel_flag.store(false, Ordering::SeqCst);

        if let Some(job) = state.jobs.get_mut(&next_id) {
            job.record.status = JobStatus::Running;
            job.record.updated_at = now;
            job.record.progress = JobProgress {
                current: 0,
                total: 0,
                current_file: "Preparing...".to_string(),
                unit: "items".to_string(),
            };
            let cloned = (job.record.clone(), job.submission.clone());
            state.active_job_id = Some(next_id.clone());
            Some((cloned.0, cloned.1, cancel_flag))
        } else {
            None
        }
    };

    let Some((record, submission, cancel_flag)) = next_job else {
        return;
    };

    emit_job_update(&app, &record);

    tauri::async_runtime::spawn(async move {
        let outcome = execute_job(&app, &inner, &record.id, &submission, cancel_flag.clone()).await;
        let final_record = {
            let mut state = match inner.lock() {
                Ok(state) => state,
                Err(_) => return,
            };

            let now = now_ms();
            if let Some(job) = state.jobs.get_mut(&record.id) {
                job.record.updated_at = now;
                match outcome {
                    Ok(result) => {
                        job.record.status = JobStatus::Completed;
                        job.record.progress = JobProgress {
                            current: 1,
                            total: 1,
                            current_file: "Completed".to_string(),
                            unit: "items".to_string(),
                        };
                        job.record.result = Some(result);
                        job.record.error = None;
                    }
                    Err(error) => {
                        let is_cancelled = error.to_lowercase().contains("cancel");
                        job.record.status = if is_cancelled {
                            JobStatus::Cancelled
                        } else {
                            JobStatus::Failed
                        };
                        job.record.error = Some(error);
                        job.record.result = None;
                    }
                }
                let cloned = job.record.clone();
                state.active_job_id = None;
                state.cancel_flags.remove(&record.id);
                Some(cloned)
            } else {
                None
            }
        };

        if let Some(record) = final_record {
            if let Ok(state) = inner.lock() {
                let _ = persist_job_engine_state(&app, &state);
            }
            emit_job_update(&app, &record);
        }

        schedule_next_job(app.clone(), inner.clone());
    });
}
