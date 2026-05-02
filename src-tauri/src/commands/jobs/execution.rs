use super::super::fs as fs_api;
use super::paths::{
    parent_directories, source_parent_and_target_directories, zip_directory_affected_directories,
};
use super::persistence::{now_ms, persist_job_engine_state};
use super::state::{InternalJobRecord, JobEngineInner};
use super::{JobProgress, JobRecord, JobResult, JobStatus, JobSubmission};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

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
    match submission {
        JobSubmission::Copy {
            source_paths,
            target_path,
            keep_both,
            overwrite,
        } => {
            let progress_inner = inner.clone();
            let progress_app = app.clone();
            let progress_job_id = job_id.to_string();
            let saved_names = fs_api::copy_files_with_cancel_and_progress(
                source_paths.clone(),
                target_path.clone(),
                *keep_both,
                *overwrite,
                Some(cancel_flag),
                move |progress| {
                    emit_job_progress_update(
                        &progress_app,
                        &progress_inner,
                        &progress_job_id,
                        &progress,
                    );
                },
            )
            .await?;

            let affected_directories =
                source_parent_and_target_directories(source_paths, target_path);

            Ok(JobResult {
                affected_directories,
                affected_entry_paths: source_paths.clone(),
                archive_path: None,
                saved_names,
            })
        }
        JobSubmission::Move {
            source_paths,
            target_dir,
        } => {
            let progress_inner = inner.clone();
            let progress_app = app.clone();
            let progress_job_id = job_id.to_string();
            fs_api::move_files_with_cancel_and_progress(
                source_paths.clone(),
                target_dir.clone(),
                Some(cancel_flag),
                move |progress| {
                    emit_job_progress_update(
                        &progress_app,
                        &progress_inner,
                        &progress_job_id,
                        &progress,
                    );
                },
            )
            .await?;

            let affected_directories =
                source_parent_and_target_directories(source_paths, target_dir);

            Ok(JobResult {
                affected_directories,
                affected_entry_paths: source_paths.clone(),
                archive_path: None,
                saved_names: Vec::new(),
            })
        }
        JobSubmission::Delete { paths, permanent } => {
            let progress_inner = inner.clone();
            let progress_app = app.clone();
            let progress_job_id = job_id.to_string();
            fs_api::delete_files_with_cancel_and_progress(
                paths.clone(),
                permanent.unwrap_or(false),
                Some(cancel_flag),
                move |progress| {
                    emit_job_progress_update(
                        &progress_app,
                        &progress_inner,
                        &progress_job_id,
                        &progress,
                    );
                },
            )
            .await?;

            let affected_directories = parent_directories(paths);

            Ok(JobResult {
                affected_directories,
                affected_entry_paths: paths.clone(),
                archive_path: None,
                saved_names: Vec::new(),
            })
        }
        JobSubmission::ZipDirectory { path } => {
            cancel_flag.store(false, Ordering::SeqCst);
            let archive_path = fs_api::create_zip(app.clone(), path.clone()).await?;
            let affected_directories = zip_directory_affected_directories(path, &archive_path);

            Ok(JobResult {
                affected_directories,
                affected_entry_paths: vec![path.clone()],
                archive_path: Some(archive_path),
                saved_names: Vec::new(),
            })
        }
        JobSubmission::ZipSelection {
            paths,
            target_dir,
            archive_name,
        } => {
            cancel_flag.store(false, Ordering::SeqCst);
            let archive_path = fs_api::create_zip_from_paths(
                app.clone(),
                paths.clone(),
                target_dir.clone(),
                archive_name.clone(),
            )
            .await?;

            let affected_directories = source_parent_and_target_directories(paths, target_dir);

            Ok(JobResult {
                affected_directories,
                affected_entry_paths: paths.clone(),
                archive_path: Some(archive_path),
                saved_names: Vec::new(),
            })
        }
    }
}

pub(crate) fn build_retry_submission(job: &InternalJobRecord) -> Result<JobSubmission, String> {
    let completed_items = usize::try_from(job.record.progress.current).unwrap_or(usize::MAX);

    match &job.submission {
        JobSubmission::Copy {
            source_paths,
            target_path,
            keep_both,
            overwrite,
        } => {
            let remaining = source_paths
                .iter()
                .skip(completed_items)
                .cloned()
                .collect::<Vec<String>>();
            if remaining.is_empty() {
                return Err("No remaining items to retry.".to_string());
            }

            Ok(JobSubmission::Copy {
                source_paths: remaining,
                target_path: target_path.clone(),
                keep_both: *keep_both,
                overwrite: *overwrite,
            })
        }
        JobSubmission::Move {
            source_paths,
            target_dir,
        } => {
            let remaining = source_paths
                .iter()
                .skip(completed_items)
                .cloned()
                .collect::<Vec<String>>();
            if remaining.is_empty() {
                return Err("No remaining items to retry.".to_string());
            }

            Ok(JobSubmission::Move {
                source_paths: remaining,
                target_dir: target_dir.clone(),
            })
        }
        JobSubmission::Delete { paths, permanent } => {
            let remaining = paths
                .iter()
                .skip(completed_items)
                .cloned()
                .collect::<Vec<String>>();
            if remaining.is_empty() {
                return Err("No remaining items to retry.".to_string());
            }

            Ok(JobSubmission::Delete {
                paths: remaining,
                permanent: *permanent,
            })
        }
        JobSubmission::ZipDirectory { path } => {
            Ok(JobSubmission::ZipDirectory { path: path.clone() })
        }
        JobSubmission::ZipSelection {
            paths,
            target_dir,
            archive_name,
        } => Ok(JobSubmission::ZipSelection {
            paths: paths.clone(),
            target_dir: target_dir.clone(),
            archive_name: archive_name.clone(),
        }),
    }
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
