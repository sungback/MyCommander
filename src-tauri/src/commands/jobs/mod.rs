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
mod tests;
