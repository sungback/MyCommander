use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub operation: String,
    pub current: u64,
    pub total: u64,
    pub current_file: String,
    pub unit: String,
}

pub(crate) fn format_command_failure(command_name: &str, output: &std::process::Output) -> String {
    let status = output
        .status
        .code()
        .map(|code| code.to_string())
        .unwrap_or_else(|| "terminated by signal".to_string());
    let stderr = compact_command_output(&output.stderr);
    let stdout = compact_command_output(&output.stdout);
    let mut details = Vec::new();

    if let Some(stderr) = stderr {
        details.push(format!("stderr: {stderr}"));
    }
    if let Some(stdout) = stdout {
        details.push(format!("stdout: {stdout}"));
    }

    if details.is_empty() {
        format!("{command_name} exited with status {status}")
    } else {
        format!(
            "{command_name} exited with status {status} ({})",
            details.join(" | ")
        )
    }
}

pub(crate) fn compact_command_output(output: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(output);
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.is_empty() {
        None
    } else {
        Some(compact)
    }
}

pub(crate) fn describe_invalid_zip_problem<'a, I>(outputs: I) -> &'static str
where
    I: IntoIterator<Item = &'a std::process::Output>,
{
    if outputs
        .into_iter()
        .any(command_output_indicates_invalid_zip)
    {
        "Archive appears to be corrupted or incomplete."
    } else {
        "Archive extraction failed."
    }
}

fn command_output_indicates_invalid_zip(output: &std::process::Output) -> bool {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    indicates_invalid_zip_message(&stderr) || indicates_invalid_zip_message(&stdout)
}

pub(crate) fn indicates_invalid_zip_message(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();

    lower.contains("pkzip signature")
        || lower.contains("end-of-central-directory signature not found")
        || lower.contains("cannot find zipfile directory")
        || lower.contains("not a zip archive")
        || lower.contains("central directory")
}

pub(crate) fn is_operation_cancelled(cancel_flag: Option<&AtomicBool>) -> bool {
    cancel_flag.is_some_and(|flag| flag.load(Ordering::SeqCst))
}
