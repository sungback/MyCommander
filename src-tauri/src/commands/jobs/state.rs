use super::{JobRecord, JobStatus, JobSubmission};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub(crate) struct InternalJobRecord {
    pub(crate) record: JobRecord,
    pub(crate) submission: JobSubmission,
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PersistedJobEngineState {
    pub(crate) next_id: u64,
    pub(crate) jobs: Vec<InternalJobRecord>,
}

#[derive(Default)]
pub(crate) struct JobEngineInner {
    pub(crate) next_id: u64,
    pub(crate) active_job_id: Option<String>,
    pub(crate) queue: VecDeque<String>,
    pub(crate) jobs: HashMap<String, InternalJobRecord>,
    pub(crate) cancel_flags: HashMap<String, Arc<AtomicBool>>,
    pub(crate) hydrated: bool,
}

#[derive(Clone, Default)]
pub struct JobEngineState {
    pub(crate) inner: Arc<Mutex<JobEngineInner>>,
}

pub(crate) fn keep_active_jobs_only(inner: &mut JobEngineInner) {
    inner
        .jobs
        .retain(|_, job| matches!(job.record.status, JobStatus::Queued | JobStatus::Running));
}
