use super::progress::{emit_zip_progress, parse_zip_progress_entry};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

pub(super) fn spawn_zip_stdout_collector<R: Read + Send + 'static>(
    stdout: R,
    app: tauri::AppHandle,
    progress_counter: Arc<AtomicU64>,
    total_entries: u64,
) -> std::thread::JoinHandle<Vec<String>> {
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut collected = Vec::new();

        for line_result in reader.lines() {
            match line_result {
                Ok(line) => {
                    let trimmed = line.trim().to_string();
                    if trimmed.is_empty() {
                        continue;
                    }

                    if let Some(entry_name) = parse_zip_progress_entry(&trimmed) {
                        let current = progress_counter.fetch_add(1, Ordering::SeqCst) + 1;
                        emit_zip_progress(
                            &app,
                            current.min(total_entries),
                            total_entries,
                            &entry_name,
                        );
                    }

                    collected.push(trimmed);
                }
                Err(error) => {
                    collected.push(format!("stdout read error: {error}"));
                    break;
                }
            }
        }

        collected
    })
}

pub(super) fn spawn_zip_stderr_collector<R: Read + Send + 'static>(
    stderr: R,
) -> std::thread::JoinHandle<Vec<String>> {
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let mut collected = Vec::new();

        for line_result in reader.lines() {
            match line_result {
                Ok(line) => {
                    let trimmed = line.trim().to_string();
                    if !trimmed.is_empty() {
                        collected.push(trimmed);
                    }
                }
                Err(error) => {
                    collected.push(format!("stderr read error: {error}"));
                    break;
                }
            }
        }

        collected
    })
}

pub(super) fn remove_temp_archive(path: &Path) {
    let _ = fs::remove_file(path);
}
