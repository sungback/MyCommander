use super::super::state::InternalJobRecord;
use super::super::JobSubmission;

fn remaining_items_after_progress(
    items: &[String],
    completed_items: usize,
) -> Result<Vec<String>, String> {
    let remaining = items
        .iter()
        .skip(completed_items)
        .cloned()
        .collect::<Vec<String>>();

    if remaining.is_empty() {
        return Err("No remaining items to retry.".to_string());
    }

    Ok(remaining)
}

pub(crate) fn build_retry_submission(job: &InternalJobRecord) -> Result<JobSubmission, String> {
    let completed_items = usize::try_from(job.record.progress.current).unwrap_or(usize::MAX);

    match &job.submission {
        JobSubmission::Copy {
            source_paths,
            target_path,
            keep_both,
            overwrite,
        } => Ok(JobSubmission::Copy {
            source_paths: remaining_items_after_progress(source_paths, completed_items)?,
            target_path: target_path.clone(),
            keep_both: *keep_both,
            overwrite: *overwrite,
        }),
        JobSubmission::Move {
            source_paths,
            target_dir,
        } => Ok(JobSubmission::Move {
            source_paths: remaining_items_after_progress(source_paths, completed_items)?,
            target_dir: target_dir.clone(),
        }),
        JobSubmission::Delete { paths, permanent } => Ok(JobSubmission::Delete {
            paths: remaining_items_after_progress(paths, completed_items)?,
            permanent: *permanent,
        }),
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
