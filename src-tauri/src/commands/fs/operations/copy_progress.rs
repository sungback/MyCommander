use crate::commands::fs::shared::ProgressPayload;
use std::path::Path;

pub(super) fn file_name_for_progress(source: &str) -> String {
    Path::new(source)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| source.to_string())
}

pub(super) fn emit_copy_progress<F>(
    emit_progress: &F,
    current: u64,
    total: u64,
    current_file: String,
) where
    F: Fn(ProgressPayload),
{
    emit_progress(ProgressPayload {
        operation: "copy".to_string(),
        current,
        total,
        current_file,
        unit: "items".to_string(),
    });
}
