use super::super::super::fs as fs_api;
use super::super::paths::{
    parent_directories, source_parent_and_target_directories, zip_directory_affected_directories,
};
use super::super::state::JobEngineInner;
use super::super::{JobResult, JobSubmission};
use super::emit_job_progress_update;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

struct JobExecutionContext<'a> {
    app: &'a AppHandle,
    inner: &'a Arc<Mutex<JobEngineInner>>,
    job_id: &'a str,
}

impl JobExecutionContext<'_> {
    fn progress_emitter(&self) -> impl Fn(fs_api::ProgressPayload) + Send + 'static {
        let progress_app = self.app.clone();
        let progress_inner = self.inner.clone();
        let progress_job_id = self.job_id.to_string();

        move |progress| {
            emit_job_progress_update(&progress_app, &progress_inner, &progress_job_id, &progress);
        }
    }
}

async fn execute_copy_job(
    context: &JobExecutionContext<'_>,
    source_paths: &[String],
    target_path: &str,
    keep_both: Option<bool>,
    overwrite: Option<bool>,
    cancel_flag: Arc<AtomicBool>,
) -> Result<JobResult, String> {
    let saved_names = fs_api::copy_files_with_cancel_and_progress(
        source_paths.to_owned(),
        target_path.to_string(),
        keep_both,
        overwrite,
        Some(cancel_flag),
        context.progress_emitter(),
    )
    .await?;

    Ok(JobResult {
        affected_directories: source_parent_and_target_directories(source_paths, target_path),
        affected_entry_paths: source_paths.to_owned(),
        archive_path: None,
        saved_names,
    })
}

async fn execute_move_job(
    context: &JobExecutionContext<'_>,
    source_paths: &[String],
    target_dir: &str,
    cancel_flag: Arc<AtomicBool>,
) -> Result<JobResult, String> {
    fs_api::move_files_with_cancel_and_progress(
        source_paths.to_owned(),
        target_dir.to_string(),
        Some(cancel_flag),
        context.progress_emitter(),
    )
    .await?;

    Ok(JobResult {
        affected_directories: source_parent_and_target_directories(source_paths, target_dir),
        affected_entry_paths: source_paths.to_owned(),
        archive_path: None,
        saved_names: Vec::new(),
    })
}

async fn execute_delete_job(
    context: &JobExecutionContext<'_>,
    paths: &[String],
    permanent: Option<bool>,
    cancel_flag: Arc<AtomicBool>,
) -> Result<JobResult, String> {
    fs_api::delete_files_with_cancel_and_progress(
        paths.to_owned(),
        permanent.unwrap_or(false),
        Some(cancel_flag),
        context.progress_emitter(),
    )
    .await?;

    Ok(JobResult {
        affected_directories: parent_directories(paths),
        affected_entry_paths: paths.to_owned(),
        archive_path: None,
        saved_names: Vec::new(),
    })
}

async fn execute_zip_directory_job(
    app: &AppHandle,
    path: &str,
    cancel_flag: Arc<AtomicBool>,
) -> Result<JobResult, String> {
    cancel_flag.store(false, Ordering::SeqCst);
    let archive_path = fs_api::create_zip(app.clone(), path.to_string()).await?;

    Ok(JobResult {
        affected_directories: zip_directory_affected_directories(path, &archive_path),
        affected_entry_paths: vec![path.to_string()],
        archive_path: Some(archive_path),
        saved_names: Vec::new(),
    })
}

async fn execute_zip_selection_job(
    app: &AppHandle,
    paths: &[String],
    target_dir: &str,
    archive_name: &str,
    cancel_flag: Arc<AtomicBool>,
) -> Result<JobResult, String> {
    cancel_flag.store(false, Ordering::SeqCst);
    let archive_path = fs_api::create_zip_from_paths(
        app.clone(),
        paths.to_owned(),
        target_dir.to_string(),
        archive_name.to_string(),
    )
    .await?;

    Ok(JobResult {
        affected_directories: source_parent_and_target_directories(paths, target_dir),
        affected_entry_paths: paths.to_owned(),
        archive_path: Some(archive_path),
        saved_names: Vec::new(),
    })
}

pub(super) async fn execute_job(
    app: &AppHandle,
    inner: &Arc<Mutex<JobEngineInner>>,
    job_id: &str,
    submission: &JobSubmission,
    cancel_flag: Arc<AtomicBool>,
) -> Result<JobResult, String> {
    let context = JobExecutionContext { app, inner, job_id };

    match submission {
        JobSubmission::Copy {
            source_paths,
            target_path,
            keep_both,
            overwrite,
        } => {
            execute_copy_job(
                &context,
                source_paths,
                target_path,
                *keep_both,
                *overwrite,
                cancel_flag,
            )
            .await
        }
        JobSubmission::Move {
            source_paths,
            target_dir,
        } => execute_move_job(&context, source_paths, target_dir, cancel_flag).await,
        JobSubmission::Delete { paths, permanent } => {
            execute_delete_job(&context, paths, *permanent, cancel_flag).await
        }
        JobSubmission::ZipDirectory { path } => {
            execute_zip_directory_job(app, path, cancel_flag).await
        }
        JobSubmission::ZipSelection {
            paths,
            target_dir,
            archive_name,
        } => execute_zip_selection_job(app, paths, target_dir, archive_name, cancel_flag).await,
    }
}
