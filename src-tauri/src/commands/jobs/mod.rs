pub(crate) mod commands;
pub(crate) mod execution;
mod paths;
pub(crate) mod persistence;
pub(crate) mod state;

use serde::{Deserialize, Serialize};

pub use state::JobEngineState;

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
        #[serde(alias = "sourcePaths")]
        source_paths: Vec<String>,
        #[serde(alias = "targetPath")]
        target_path: String,
        #[serde(alias = "keepBoth")]
        keep_both: Option<bool>,
        overwrite: Option<bool>,
    },
    Move {
        #[serde(alias = "sourcePaths")]
        source_paths: Vec<String>,
        #[serde(alias = "targetDir")]
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
        #[serde(alias = "targetDir")]
        target_dir: String,
        #[serde(alias = "archiveName")]
        archive_name: String,
    },
}

impl JobSubmission {
    pub(crate) fn kind(&self) -> JobKind {
        match self {
            JobSubmission::Copy { .. } => JobKind::Copy,
            JobSubmission::Move { .. } => JobKind::Move,
            JobSubmission::Delete { .. } => JobKind::Delete,
            JobSubmission::ZipDirectory { .. } | JobSubmission::ZipSelection { .. } => JobKind::Zip,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::execution::build_retry_submission;
    use super::persistence::{restore_job_engine_state, snapshot_persisted_state};
    use super::state::{InternalJobRecord, JobEngineInner, PersistedJobEngineState};
    use super::*;
    use std::collections::VecDeque;

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
                    overwrite: None,
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

        inner
            .jobs
            .retain(|_, job| matches!(job.record.status, JobStatus::Queued | JobStatus::Running));

        assert!(inner.jobs.contains_key("queued"));
        assert!(!inner.jobs.contains_key("done"));
    }

    #[test]
    fn persisted_snapshot_roundtrips_and_requeues_queued_jobs() {
        let mut inner = JobEngineInner {
            next_id: 7,
            ..Default::default()
        };
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
                    overwrite: None,
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
                source_paths: vec![
                    "/tmp/a.txt".into(),
                    "/tmp/b.txt".into(),
                    "/tmp/c.txt".into(),
                ],
                target_path: "/dest".into(),
                keep_both: Some(false),
                overwrite: Some(true),
            },
        };

        let retry = build_retry_submission(&job).expect("retry submission");

        match retry {
            JobSubmission::Copy {
                source_paths,
                target_path,
                keep_both,
                overwrite,
            } => {
                assert_eq!(source_paths, vec!["/tmp/b.txt", "/tmp/c.txt"]);
                assert_eq!(target_path, "/dest");
                assert_eq!(keep_both, Some(false));
                assert_eq!(overwrite, Some(true));
            }
            other => panic!("unexpected retry submission: {other:?}"),
        }
    }

    #[test]
    fn schedule_next_job_uses_tauri_runtime_spawn() {
        let source = include_str!("execution.rs");

        assert!(
            source.contains("tauri::async_runtime::spawn("),
            "schedule_next_job should spawn jobs on tauri::async_runtime to avoid panicking outside a Tokio runtime"
        );
        assert!(
            !source.contains("tokio::spawn("),
            "schedule_next_job should not call tokio::spawn directly from Tauri invoke handlers"
        );
    }

    #[test]
    fn job_submission_deserializes_camel_case_copy_fields() {
        let submission = serde_json::from_value::<JobSubmission>(serde_json::json!({
            "kind": "copy",
            "sourcePaths": ["/tmp/a.txt"],
            "targetPath": "/tmp/dest",
            "keepBoth": true,
            "overwrite": true,
        }))
        .expect("camelCase copy payload should deserialize");

        match submission {
            JobSubmission::Copy {
                source_paths,
                target_path,
                keep_both,
                overwrite,
            } => {
                assert_eq!(source_paths, vec!["/tmp/a.txt"]);
                assert_eq!(target_path, "/tmp/dest");
                assert_eq!(keep_both, Some(true));
                assert_eq!(overwrite, Some(true));
            }
            other => panic!("unexpected submission: {other:?}"),
        }
    }
}
