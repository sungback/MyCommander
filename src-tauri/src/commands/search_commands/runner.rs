use super::config::SearchConfig;
use super::matchers::{
    matches_entry_kind, matches_extensions, matches_modified_range, matches_query, matches_size,
};
use super::{SearchEvent, SearchResult};
use crate::commands::fs::metadata::is_hidden_entry;
use glob::Pattern;
use regex::Regex;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use walkdir::WalkDir;

pub(crate) fn run_search(
    start_path: String,
    config: SearchConfig,
    re: Option<Regex>,
    wildcard_patterns: Vec<Pattern>,
    on_event: Channel<SearchEvent>,
) {
    let normalized_query = config.normalized_query();
    let mut results_batch = Vec::new();
    let mut total_matches = 0;
    let mut last_progress_time = Instant::now();
    let walker = WalkDir::new(&start_path).into_iter().filter_map(|e| e.ok());

    for entry in walker {
        let path = entry.path();

        if last_progress_time.elapsed() > Duration::from_millis(100) {
            let _ = on_event.send(SearchEvent::Progress {
                current_dir: path.parent().unwrap_or(path).to_string_lossy().into_owned(),
            });
            last_progress_time = Instant::now();
        }

        let file_name = entry.file_name().to_string_lossy().into_owned();
        let metadata = entry.metadata().ok();
        let is_dir = metadata
            .as_ref()
            .map(|value| value.is_dir())
            .unwrap_or(entry.file_type().is_dir());

        if !should_visit_entry(&config, &file_name, is_dir, metadata.as_ref()) {
            continue;
        }

        let modified_ms = metadata
            .as_ref()
            .and_then(|value| value.modified().ok())
            .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|value| value.as_millis() as u64);
        let size = metadata.as_ref().map(|value| value.len());

        if !matches_size(size, config.min_size_bytes, config.max_size_bytes)
            || !matches_modified_range(
                modified_ms,
                config.modified_after_ms,
                config.modified_before_ms,
            )
        {
            continue;
        }

        let search_candidate = if config.scope == "path" {
            path.to_string_lossy().into_owned()
        } else {
            file_name.clone()
        };
        let normalized_candidate = if config.case_sensitive {
            search_candidate
        } else {
            search_candidate.to_lowercase()
        };

        if matches_query(
            &normalized_candidate,
            &normalized_query,
            config.case_sensitive,
            config.use_regex,
            re.as_ref(),
            &wildcard_patterns,
        ) {
            results_batch.push(SearchResult {
                name: file_name,
                path: path.to_string_lossy().into_owned(),
                size,
                is_dir,
            });

            total_matches += 1;

            if results_batch.len() >= 50 {
                let _ = on_event.send(SearchEvent::ResultBatch(results_batch.clone()));
                results_batch.clear();
            }

            if total_matches >= config.max_results {
                break;
            }
        }
    }

    if !results_batch.is_empty() {
        let _ = on_event.send(SearchEvent::ResultBatch(results_batch));
    }

    let _ = on_event.send(SearchEvent::Finished { total_matches });
}

fn should_visit_entry(
    config: &SearchConfig,
    file_name: &str,
    is_dir: bool,
    metadata: Option<&std::fs::Metadata>,
) -> bool {
    if !config.include_hidden {
        match metadata {
            Some(metadata) if is_hidden_entry(file_name, metadata) => return false,
            None if file_name.starts_with('.') => return false,
            _ => {}
        }
    }

    matches_entry_kind(is_dir, &config.entry_kind)
        && matches_extensions(file_name, is_dir, &config.extensions)
}
