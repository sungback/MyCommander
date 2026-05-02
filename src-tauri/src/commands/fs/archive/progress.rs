use crate::commands::fs::shared::ProgressPayload;
use tauri::Emitter;

pub(super) fn parse_zip_progress_entry(line: &str) -> Option<String> {
    let stripped = line.strip_prefix("adding:")?.trim();
    let entry = stripped
        .split_once(" (")
        .map(|(name, _)| name)
        .unwrap_or(stripped)
        .trim();

    if entry.is_empty() {
        None
    } else {
        Some(entry.to_string())
    }
}

pub(super) fn build_zip_failure_details(
    status_code: Option<i32>,
    stdout_lines: &[String],
    stderr_lines: &[String],
) -> String {
    let status = status_code
        .map(|code| code.to_string())
        .unwrap_or_else(|| "terminated by signal".to_string());
    let mut details = Vec::new();

    if !stderr_lines.is_empty() {
        details.push(format!("stderr: {}", stderr_lines.join(" | ")));
    }
    if !stdout_lines.is_empty() {
        details.push(format!("stdout: {}", stdout_lines.join(" | ")));
    }

    if details.is_empty() {
        format!("zip exited with status {status}")
    } else {
        format!("zip exited with status {status} ({})", details.join(" | "))
    }
}

pub(super) fn build_zip_canceled_message(
    stdout_lines: &[String],
    stderr_lines: &[String],
) -> String {
    let mut details = Vec::new();

    if !stderr_lines.is_empty() {
        details.push(format!("stderr: {}", stderr_lines.join(" | ")));
    }
    if !stdout_lines.is_empty() {
        details.push(format!("stdout: {}", stdout_lines.join(" | ")));
    }

    if details.is_empty() {
        "Archive creation was canceled.".to_string()
    } else {
        format!("Archive creation was canceled. {}", details.join(" | "))
    }
}

pub(super) fn emit_zip_progress(
    app: &tauri::AppHandle,
    current: u64,
    total: u64,
    current_file: &str,
) {
    let _ = app.emit(
        "fs-progress",
        ProgressPayload {
            operation: "zip".to_string(),
            current,
            total,
            current_file: current_file.to_string(),
            unit: "items".to_string(),
        },
    );
}
