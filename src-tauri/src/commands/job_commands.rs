use super::fs_commands;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum JobKind {
    Copy,
    Move,
    Delete,
    Zip,
}

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub current: u64,
    pub total: u64,
    pub current_file: String,
    pub unit: String,
}

impl Default for JobProgress {
    fn default() -> Self {
        Self {
            current: 0,
            total: 0,
            current_file: String::new(),
            unit: "items".to_string(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct JobResult {
    pub affected_directories: Vec<String>,
    pub affected_entry_paths: Vec<String>,
    pub archive_path: Option<String>,
    pub saved_names: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct JobRecord {
    pub id: String,
    pub kind: JobKind,
    pub status: JobStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub progress: JobProgress,
    pub error: Option<String>,
    pub result: Option<JobResult>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum JobSubmission {
    Copy {
        source_paths: Vec<String>,
        target_path: String,
        keep_both: Option<bool>,
    },
    Move {
        source_paths: Vec<String>,
        target_dir: String,
    },
    Delete {
        paths: Vec<String>,
        permanent: Option<bool>,
    },
    ZipDirectory {
        path: String,
    },
    ZipSelection {
        paths: Vec<String>,
        target_dir: String,
        archive_name: String,
    },
}

impl JobSubmission {
    fn kind(&self) -> JobKind {
        match self {
            JobSubmission::Copy { .. } => JobKind::Copy,
            JobSubmission::Move { .. } => JobKind::Move,
            JobSubmission::Delete { .. } => JobKind::Delete,
            JobSubmission::ZipDirectory { .. } | JobSubmission::ZipSelection { .. } => JobKind::Zip,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct InternalJobRecord {
    record: JobRecord,
    submission: JobSubmission,
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedJobEngineState {
    next_id: u64,
    jobs: Vec<InternalJobRecord>,
}

#[derive(Default)]
struct JobEngineInner {
    next_id: u64,
    active_job_id: Option<String>,
    queue: VecDeque<String>,
    jobs: HashMap<String, InternalJobRecord>,
    cancel_flags: HashMap<String, Arc<AtomicBool>>,
    hydrated: bool,
}

#[derive(Clone, Default)]
pub struct JobEngineState {
    inner: Arc<Mutex<JobEngineInner>>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn snapshot_persisted_state(inner: &JobEngineInner) -> PersistedJobEngineState {
    let mut jobs = inner.jobs.values().cloned().collect::<Vec<InternalJobRecord>>();
    jobs.sort_by_key(|job| job.record.created_at);
    PersistedJobEngineState {
        next_id: inner.next_id,
        jobs,
    }
}

fn restore_job_engine_state(snapshot: PersistedJobEngineState) -> JobEngineInner {
    let mut inner = JobEngineInner {
        next_id: snapshot.next_id,
        active_job_id: None,
        queue: VecDeque::new(),
        jobs: HashMap::new(),
        cancel_flags: HashMap::new(),
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

fn persist_job_engine_state(app: &AppHandle, inner: &JobEngineInner) -> Result<(), String> {
    let file_path = persistence_file_path(app)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Failed to create job state dir: {error}"))?;
    }

    let snapshot = snapshot_persisted_state(inner);
    let content =
        serde_json::to_string_pretty(&snapshot).map_err(|error| format!("Failed to encode job state: {error}"))?;
    fs::write(&file_path, content).map_err(|error| format!("Failed to write job state: {error}"))
}

fn hydrate_job_engine_state(app: &AppHandle, inner: &mut JobEngineInner) -> Result<(), String> {
    if inner.hydrated {
        return Ok(());
    }

    let file_path = persistence_file_path(app)?;
    if !file_path.exists() {
        inner.hydrated = true;
        return Ok(());
    }

    let content = fs::read_to_string(&file_path).map_err(|error| format!("Failed to read job state: {error}"))?;
    let snapshot: PersistedJobEngineState =
        serde_json::from_str(&content).map_err(|error| format!("Failed to parse job state: {error}"))?;
    *inner = restore_job_engine_state(snapshot);
    Ok(())
}

fn emit_job_update(app: &AppHandle, record: &JobRecord) {
    let _ = app.emit("job-updated", record);
}

fn emit_job_progress_update(
    app: &AppHandle,
    inner: &Arc<Mutex<JobEngineInner>>,
    job_id: &str,
    progress: &fs_commands::ProgressPayload,
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

fn public_records(inner: &JobEngineInner) -> Vec<JobRecord> {
    let mut jobs = inner
        .jobs
        .values()
        .map(|job| job.record.clone())
        .collect::<Vec<JobRecord>>();
    jobs.sort_by_key(|job| job.created_at);
    jobs
}

fn path_parent(path: &str) -> Option<String> {
    Path::new(path)
        .parent()
        .map(|parent| parent.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
}

fn unique_directories(paths: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut values = Vec::new();

    for path in paths {
        if seen.insert(path.clone()) {
            values.push(path);
        }
    }

    values
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
        } => {
            let progress_inner = inner.clone();
            let progress_app = app.clone();
            let progress_job_id = job_id.to_string();
            let saved_names = fs_commands::copy_files_with_cancel_and_progress(
                source_paths.clone(),
                target_path.clone(),
                *keep_both,
                Some(cancel_flag),
                move |progress| {
                    emit_job_progress_update(&progress_app, &progress_inner, &progress_job_id, &progress);
                },
            )
            .await?;

            let affected_directories = unique_directories(
                source_paths
                    .iter()
                    .filter_map(|path| path_parent(path))
                    .chain(std::iter::once(target_path.clone())),
            );

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
            fs_commands::move_files_with_cancel_and_progress(
                source_paths.clone(),
                target_dir.clone(),
                Some(cancel_flag),
                move |progress| {
                    emit_job_progress_update(&progress_app, &progress_inner, &progress_job_id, &progress);
                },
            )
            .await?;

            let affected_directories = unique_directories(
                source_paths
                    .iter()
                    .filter_map(|path| path_parent(path))
                    .chain(std::iter::once(target_dir.clone())),
            );

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
            fs_commands::delete_files_with_cancel_and_progress(
                paths.clone(),
                permanent.unwrap_or(false),
                Some(cancel_flag),
                move |progress| {
                    emit_job_progress_update(&progress_app, &progress_inner, &progress_job_id, &progress);
                },
            )
            .await?;

            let affected_directories =
                unique_directories(paths.iter().filter_map(|path| path_parent(path)));

            Ok(JobResult {
                affected_directories,
                affected_entry_paths: paths.clone(),
                archive_path: None,
                saved_names: Vec::new(),
            })
        }
        JobSubmission::ZipDirectory { path } => {
            cancel_flag.store(false, Ordering::SeqCst);
            let archive_path = fs_commands::create_zip(app.clone(), path.clone()).await?;
            let affected_directories = unique_directories(
                path_parent(path)
                    .into_iter()
                    .chain(path_parent(&archive_path).into_iter()),
            );

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
            let archive_path = fs_commands::create_zip_from_paths(
                app.clone(),
                paths.clone(),
                target_dir.clone(),
                archive_name.clone(),
            )
            .await?;

            let affected_directories = unique_directories(
                paths.iter()
                    .filter_map(|path| path_parent(path))
                    .chain(std::iter::once(target_dir.clone())),
            );

            Ok(JobResult {
                affected_directories,
                affected_entry_paths: paths.clone(),
                archive_path: Some(archive_path),
                saved_names: Vec::new(),
            })
        }
    }
}

fn build_retry_submission(job: &InternalJobRecord) -> Result<JobSubmission, String> {
    let completed_items = usize::try_from(job.record.progress.current).unwrap_or(usize::MAX);

    match &job.submission {
        JobSubmission::Copy {
            source_paths,
            target_path,
            keep_both,
        } => {
            let remaining = source_paths.iter().skip(completed_items).cloned().collect::<Vec<String>>();
            if remaining.is_empty() {
                return Err("No remaining items to retry.".to_string());
            }

            Ok(JobSubmission::Copy {
                source_paths: remaining,
                target_path: target_path.clone(),
                keep_both: *keep_both,
            })
        }
        JobSubmission::Move {
            source_paths,
            target_dir,
        } => {
            let remaining = source_paths.iter().skip(completed_items).cloned().collect::<Vec<String>>();
            if remaining.is_empty() {
                return Err("No remaining items to retry.".to_string());
            }

            Ok(JobSubmission::Move {
                source_paths: remaining,
                target_dir: target_dir.clone(),
            })
        }
        JobSubmission::Delete { paths, permanent } => {
            let remaining = paths.iter().skip(completed_items).cloned().collect::<Vec<String>>();
            if remaining.is_empty() {
                return Err("No remaining items to retry.".to_string());
            }

            Ok(JobSubmission::Delete {
                paths: remaining,
                permanent: *permanent,
            })
        }
        JobSubmission::ZipDirectory { path } => Ok(JobSubmission::ZipDirectory { path: path.clone() }),
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

fn schedule_next_job(app: AppHandle, inner: Arc<Mutex<JobEngineInner>>) {
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

    tokio::spawn(async move {
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
pub fn list_jobs(app: AppHandle, state: State<'_, JobEngineState>) -> Result<Vec<JobRecord>, String> {
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
    inner.jobs.retain(|_, job| {
        matches!(job.record.status, JobStatus::Queued | JobStatus::Running)
    });
    let active_job_ids = inner.jobs.keys().cloned().collect::<std::collections::HashSet<String>>();
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
                .collect::<VecDeque<String>>();

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
                fs_commands::cancel_zip_operation()?;
            }

            return Ok(job.record.clone());
        }
    }

    Err("Only queued or active jobs can be cancelled.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clear_finished_jobs_keeps_only_active_queue_entries() {
        let mut inner = JobEngineInner::default();
        inner.jobs.insert(
            "queued".into(),
            InternalJobRecord {
                record: JobRecord {
                    id: "queued".into(),
                    kind: JobKind::Copy,
                    status: JobStatus::Queued,
                    created_at: 1,
                    updated_at: 1,
                    progress: JobProgress::default(),
                    error: None,
                    result: None,
                },
                submission: JobSubmission::Copy {
                    source_paths: vec!["/tmp/a".into()],
                    target_path: "/tmp/b".into(),
                    keep_both: None,
                },
            },
        );
        inner.jobs.insert(
            "done".into(),
            InternalJobRecord {
                record: JobRecord {
                    id: "done".into(),
                    kind: JobKind::Delete,
                    status: JobStatus::Completed,
                    created_at: 1,
                    updated_at: 2,
                    progress: JobProgress::default(),
                    error: None,
                    result: None,
                },
                submission: JobSubmission::Delete {
                    paths: vec!["/tmp/a".into()],
                    permanent: None,
                },
            },
        );

        inner.jobs.retain(|_, job| {
            matches!(job.record.status, JobStatus::Queued | JobStatus::Running)
        });

        assert!(inner.jobs.contains_key("queued"));
        assert!(!inner.jobs.contains_key("done"));
    }

    #[test]
    fn persisted_snapshot_roundtrips_and_requeues_queued_jobs() {
        let mut inner = JobEngineInner::default();
        inner.next_id = 7;
        inner.jobs.insert(
            "job-1".into(),
            InternalJobRecord {
                record: JobRecord {
                    id: "job-1".into(),
                    kind: JobKind::Copy,
                    status: JobStatus::Queued,
                    created_at: 1,
                    updated_at: 1,
                    progress: JobProgress::default(),
                    error: None,
                    result: None,
                },
                submission: JobSubmission::Copy {
                    source_paths: vec!["/tmp/a".into()],
                    target_path: "/tmp/b".into(),
                    keep_both: None,
                },
            },
        );
        inner.jobs.insert(
            "job-2".into(),
            InternalJobRecord {
                record: JobRecord {
                    id: "job-2".into(),
                    kind: JobKind::Delete,
                    status: JobStatus::Completed,
                    created_at: 2,
                    updated_at: 3,
                    progress: JobProgress::default(),
                    error: None,
                    result: Some(JobResult::default()),
                },
                submission: JobSubmission::Delete {
                    paths: vec!["/tmp/a".into()],
                    permanent: None,
                },
            },
        );

        let snapshot = snapshot_persisted_state(&inner);
        let restored = restore_job_engine_state(snapshot);

        assert_eq!(restored.next_id, 7);
        assert_eq!(restored.active_job_id, None);
        assert_eq!(restored.queue, VecDeque::from([String::from("job-1")]));
        assert!(restored.jobs.contains_key("job-1"));
        assert!(restored.jobs.contains_key("job-2"));
        assert!(restored.cancel_flags.contains_key("job-1"));
        assert!(restored.cancel_flags.contains_key("job-2"));
    }

    #[test]
    fn restore_job_engine_state_marks_running_jobs_as_failed() {
        let snapshot = PersistedJobEngineState {
            next_id: 3,
            jobs: vec![InternalJobRecord {
                record: JobRecord {
                    id: "job-3".into(),
                    kind: JobKind::Move,
                    status: JobStatus::Running,
                    created_at: 1,
                    updated_at: 2,
                    progress: JobProgress {
                        current: 1,
                        total: 5,
                        current_file: "foo".into(),
                        unit: "items".into(),
                    },
                    error: None,
                    result: None,
                },
                submission: JobSubmission::Move {
                    source_paths: vec!["/tmp/a".into()],
                    target_dir: "/tmp/b".into(),
                },
            }],
        };

        let restored = restore_job_engine_state(snapshot);
        let running = restored.jobs.get("job-3").expect("job restored");

        assert_eq!(running.record.status, JobStatus::Failed);
        assert_eq!(
            running.record.error.as_deref(),
            Some("Interrupted by app restart before completion.")
        );
        assert!(restored.queue.is_empty());
    }

    #[test]
    fn restore_job_engine_state_sets_hydrated_flag() {
        let restored = restore_job_engine_state(PersistedJobEngineState::default());

        assert!(restored.hydrated);
        assert!(restored.jobs.is_empty());
        assert!(restored.queue.is_empty());
    }

    #[test]
    fn build_retry_submission_skips_completed_copy_items() {
        let job = InternalJobRecord {
            record: JobRecord {
                id: "job-1".into(),
                kind: JobKind::Copy,
                status: JobStatus::Failed,
                created_at: 1,
                updated_at: 2,
                progress: JobProgress {
                    current: 1,
                    total: 3,
                    current_file: "b.txt".into(),
                    unit: "items".into(),
                },
                error: Some("Cancelled".into()),
                result: None,
            },
            submission: JobSubmission::Copy {
                source_paths: vec!["/tmp/a.txt".into(), "/tmp/b.txt".into(), "/tmp/c.txt".into()],
                target_path: "/dest".into(),
                keep_both: Some(false),
            },
        };

        let retry = build_retry_submission(&job).expect("retry submission");

        match retry {
            JobSubmission::Copy { source_paths, target_path, keep_both } => {
                assert_eq!(source_paths, vec!["/tmp/b.txt", "/tmp/c.txt"]);
                assert_eq!(target_path, "/dest");
                assert_eq!(keep_both, Some(false));
            }
            other => panic!("unexpected retry submission: {other:?}"),
        }
    }
}
