use glob::Pattern;
use regex::Regex;
use serde::Serialize;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub struct SearchResult {
    name: String,
    path: String,
    size: Option<u64>,
    is_dir: bool,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "payload")]
pub enum SearchEvent {
    ResultBatch(Vec<SearchResult>),
    Progress {
        current_dir: String,
    },
    Finished {
        total_matches: usize,
    },
    #[allow(dead_code)]
    Error(String),
}

fn matches_query(
    file_name: &str,
    query: &str,
    use_regex: bool,
    re: Option<&Regex>,
    wildcard_patterns: &[Pattern],
) -> bool {
    if use_regex {
        return re.map(|regex| regex.is_match(file_name)).unwrap_or(false);
    }

    if !wildcard_patterns.is_empty() {
        return wildcard_patterns
            .iter()
            .any(|pattern| pattern.matches(file_name));
    }

    file_name.contains(query)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn search_files(
    start_path: String,
    query: String,
    use_regex: bool,
    on_event: Channel<SearchEvent>,
) -> Result<(), String> {
    let trimmed_query = query.trim().to_string();
    let re = if use_regex {
        Regex::new(&query).ok()
    } else {
        None
    };
    let wildcard_patterns = if use_regex || trimmed_query.is_empty() {
        Vec::new()
    } else {
        trimmed_query
            .split(';')
            .map(str::trim)
            .filter(|pattern| !pattern.is_empty())
            .filter(|pattern| pattern.contains('*') || pattern.contains('?'))
            .filter_map(|pattern| Pattern::new(pattern).ok())
            .collect::<Vec<_>>()
    };

    tokio::task::spawn_blocking(move || {
        let mut results_batch = Vec::new();
        let mut total_matches = 0;
        let mut last_progress_time = Instant::now();

        let walker = WalkDir::new(&start_path).into_iter().filter_map(|e| e.ok());

        for entry in walker {
            let path = entry.path();

            // Periodically send progress updates to UI (every 100ms)
            if last_progress_time.elapsed() > Duration::from_millis(100) {
                let _ = on_event.send(SearchEvent::Progress {
                    current_dir: path.parent().unwrap_or(path).to_string_lossy().into_owned(),
                });
                last_progress_time = Instant::now();
            }

            let file_name = entry.file_name().to_string_lossy();
            let matches = matches_query(
                &file_name,
                &trimmed_query,
                use_regex,
                re.as_ref(),
                &wildcard_patterns,
            );

            if matches {
                let metadata = entry.metadata().ok();
                results_batch.push(SearchResult {
                    name: file_name.into_owned(),
                    path: path.to_string_lossy().into_owned(),
                    size: metadata.as_ref().map(|m| m.len()),
                    is_dir: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
                });

                total_matches += 1;

                // Send matches in chunks of 50
                if results_batch.len() >= 50 {
                    let _ = on_event.send(SearchEvent::ResultBatch(results_batch.clone()));
                    results_batch.clear();
                }

                if total_matches >= 5000 {
                    break; // Hard limit
                }
            }
        }

        if !results_batch.is_empty() {
            let _ = on_event.send(SearchEvent::ResultBatch(results_batch));
        }

        let _ = on_event.send(SearchEvent::Finished { total_matches });
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::matches_query;
    use glob::Pattern;
    use regex::Regex;

    #[test]
    fn plain_text_search_preserves_case() {
        assert!(matches_query("Report.txt", "Report", false, None, &[]));
        assert!(!matches_query("Report.txt", "report", false, None, &[]));
    }

    #[test]
    fn wildcard_search_preserves_case() {
        let patterns = vec![Pattern::new("*.TXT").expect("valid pattern")];

        assert!(matches_query("README.TXT", "*.TXT", false, None, &patterns));
        assert!(!matches_query(
            "readme.txt",
            "*.TXT",
            false,
            None,
            &patterns
        ));
    }

    #[test]
    fn regex_search_keeps_existing_behavior() {
        let regex = Regex::new("^[A-Z]+\\.txt$").expect("valid regex");

        assert!(matches_query(
            "README.txt",
            "^[A-Z]+\\.txt$",
            true,
            Some(&regex),
            &[]
        ));
        assert!(!matches_query(
            "readme.txt",
            "^[A-Z]+\\.txt$",
            true,
            Some(&regex),
            &[]
        ));
    }
}
