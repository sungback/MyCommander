use glob::Pattern;
use regex::{Regex, RegexBuilder};
use serde::Serialize;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use walkdir::WalkDir;
use super::fs::metadata::is_hidden_entry;

#[derive(Clone)]
struct SearchConfig {
    query: String,
    use_regex: bool,
    case_sensitive: bool,
    include_hidden: bool,
    scope: String,
    entry_kind: String,
    extensions: Vec<String>,
    min_size_bytes: Option<u64>,
    max_size_bytes: Option<u64>,
    modified_after_ms: Option<u64>,
    modified_before_ms: Option<u64>,
    max_results: usize,
}

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
    candidate: &str,
    query: &str,
    case_sensitive: bool,
    use_regex: bool,
    re: Option<&Regex>,
    wildcard_patterns: &[Pattern],
) -> bool {
    if use_regex {
        return re.map(|regex| regex.is_match(candidate)).unwrap_or(false);
    }

    if !wildcard_patterns.is_empty() {
        return wildcard_patterns
            .iter()
            .any(|pattern| pattern.matches(candidate));
    }

    if case_sensitive {
        candidate.contains(query)
    } else {
        candidate.to_lowercase().contains(&query.to_lowercase())
    }
}

fn matches_entry_kind(is_dir: bool, entry_kind: &str) -> bool {
    match entry_kind {
        "files" => !is_dir,
        "directories" => is_dir,
        _ => true,
    }
}

fn matches_extensions(file_name: &str, is_dir: bool, extensions: &[String]) -> bool {
    if extensions.is_empty() {
        return true;
    }

    if is_dir {
        return false;
    }

    let ext = std::path::Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase());

    ext.as_ref()
        .is_some_and(|value| extensions.iter().any(|allowed| allowed == value))
}

fn matches_size(size: Option<u64>, min_size_bytes: Option<u64>, max_size_bytes: Option<u64>) -> bool {
    if min_size_bytes.is_none() && max_size_bytes.is_none() {
        return true;
    }

    let Some(size) = size else {
        return false;
    };

    if let Some(min_size_bytes) = min_size_bytes {
        if size < min_size_bytes {
            return false;
        }
    }

    if let Some(max_size_bytes) = max_size_bytes {
        if size > max_size_bytes {
            return false;
        }
    }

    true
}

fn matches_modified_range(
    modified_ms: Option<u64>,
    modified_after_ms: Option<u64>,
    modified_before_ms: Option<u64>,
) -> bool {
    if modified_after_ms.is_none() && modified_before_ms.is_none() {
        return true;
    }

    let Some(modified_ms) = modified_ms else {
        return false;
    };

    if let Some(modified_after_ms) = modified_after_ms {
        if modified_ms < modified_after_ms {
            return false;
        }
    }

    if let Some(modified_before_ms) = modified_before_ms {
        if modified_ms > modified_before_ms {
            return false;
        }
    }

    true
}

#[tauri::command(rename_all = "snake_case")]
pub async fn search_files(
    start_path: String,
    query: String,
    use_regex: bool,
    case_sensitive: Option<bool>,
    include_hidden: Option<bool>,
    scope: Option<String>,
    entry_kind: Option<String>,
    extensions: Option<Vec<String>>,
    min_size_bytes: Option<u64>,
    max_size_bytes: Option<u64>,
    modified_after_ms: Option<u64>,
    modified_before_ms: Option<u64>,
    max_results: Option<usize>,
    on_event: Channel<SearchEvent>,
) -> Result<(), String> {
    let trimmed_query = query.trim().to_string();
    let case_sensitive = case_sensitive.unwrap_or(true);
    let config = SearchConfig {
        query: trimmed_query.clone(),
        use_regex,
        case_sensitive,
        include_hidden: include_hidden.unwrap_or(true),
        scope: scope.unwrap_or_else(|| "name".to_string()),
        entry_kind: entry_kind.unwrap_or_else(|| "all".to_string()),
        extensions: extensions
            .unwrap_or_default()
            .into_iter()
            .map(|value| value.trim().trim_start_matches('.').to_lowercase())
            .filter(|value| !value.is_empty())
            .collect(),
        min_size_bytes,
        max_size_bytes,
        modified_after_ms,
        modified_before_ms,
        max_results: max_results.unwrap_or(5000),
    };
    let re = if config.use_regex {
        RegexBuilder::new(&query)
            .case_insensitive(!config.case_sensitive)
            .build()
            .ok()
    } else {
        None
    };
    let wildcard_patterns = if config.use_regex || trimmed_query.is_empty() {
        Vec::new()
    } else {
        trimmed_query
            .split(';')
            .map(str::trim)
            .filter(|pattern| !pattern.is_empty())
            .filter(|pattern| pattern.contains('*') || pattern.contains('?'))
            .map(|pattern| {
                if case_sensitive {
                    pattern.to_string()
                } else {
                    pattern.to_lowercase()
                }
            })
            .filter_map(|pattern| Pattern::new(&pattern).ok())
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

            let file_name = entry.file_name().to_string_lossy().into_owned();
            let metadata = entry.metadata().ok();
            let is_dir = metadata
                .as_ref()
                .map(|value| value.is_dir())
                .unwrap_or(entry.file_type().is_dir());

            if !config.include_hidden {
                if let Some(metadata) = metadata.as_ref() {
                    if is_hidden_entry(&file_name, metadata) {
                        continue;
                    }
                } else if file_name.starts_with('.') {
                    continue;
                }
            }

            if !matches_entry_kind(is_dir, &config.entry_kind) {
                continue;
            }

            if !matches_extensions(&file_name, is_dir, &config.extensions) {
                continue;
            }

            let modified_ms = metadata
                .as_ref()
                .and_then(|value| value.modified().ok())
                .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|value| value.as_millis() as u64);
            let size = metadata.as_ref().map(|value| value.len());

            if !matches_size(size, config.min_size_bytes, config.max_size_bytes) {
                continue;
            }

            if !matches_modified_range(
                modified_ms,
                config.modified_after_ms,
                config.modified_before_ms,
            ) {
                continue;
            }

            let search_candidate = if config.scope == "path" {
                path.to_string_lossy().into_owned()
            } else {
                file_name.clone()
            };
            let normalized_candidate = if config.case_sensitive {
                search_candidate.clone()
            } else {
                search_candidate.to_lowercase()
            };
            let normalized_query = if config.case_sensitive {
                config.query.clone()
            } else {
                config.query.to_lowercase()
            };

            let matches = matches_query(
                &normalized_candidate,
                &normalized_query,
                config.case_sensitive,
                config.use_regex,
                re.as_ref(),
                &wildcard_patterns,
            );

            if matches {
                results_batch.push(SearchResult {
                    name: file_name,
                    path: path.to_string_lossy().into_owned(),
                    size,
                    is_dir,
                });

                total_matches += 1;

                // Send matches in chunks of 50
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
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        matches_entry_kind, matches_extensions, matches_modified_range, matches_query,
        matches_size,
    };
    use glob::Pattern;
    use regex::Regex;

    #[test]
    fn plain_text_search_preserves_case() {
        assert!(matches_query("Report.txt", "Report", true, false, None, &[]));
        assert!(!matches_query("Report.txt", "report", true, false, None, &[]));
    }

    #[test]
    fn wildcard_search_preserves_case() {
        let patterns = vec![Pattern::new("*.TXT").expect("valid pattern")];

        assert!(matches_query("README.TXT", "*.TXT", true, false, None, &patterns));
        assert!(!matches_query(
            "readme.txt",
            "*.TXT",
            true,
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
            true,
            Some(&regex),
            &[]
        ));
        assert!(!matches_query(
            "readme.txt",
            "^[A-Z]+\\.txt$",
            true,
            true,
            Some(&regex),
            &[]
        ));
    }

    #[test]
    fn plain_text_search_can_ignore_case() {
        assert!(matches_query("report.txt", "REPORT", false, false, None, &[]));
    }

    #[test]
    fn entry_kind_filter_matches_expected_types() {
        assert!(matches_entry_kind(true, "all"));
        assert!(matches_entry_kind(false, "files"));
        assert!(!matches_entry_kind(true, "files"));
        assert!(matches_entry_kind(true, "directories"));
        assert!(!matches_entry_kind(false, "directories"));
    }

    #[test]
    fn extension_filter_normalizes_to_lowercase() {
        assert!(matches_extensions("Report.TXT", false, &[String::from("txt")]));
        assert!(!matches_extensions("Report.md", false, &[String::from("txt")]));
        assert!(!matches_extensions("docs", true, &[String::from("txt")]));
    }

    #[test]
    fn size_filter_respects_min_and_max() {
        assert!(matches_size(Some(1024), Some(100), Some(2048)));
        assert!(!matches_size(Some(50), Some(100), Some(2048)));
        assert!(!matches_size(Some(4096), Some(100), Some(2048)));
    }

    #[test]
    fn modified_filter_respects_range() {
        assert!(matches_modified_range(Some(1500), Some(1000), Some(2000)));
        assert!(!matches_modified_range(Some(500), Some(1000), Some(2000)));
        assert!(!matches_modified_range(Some(2500), Some(1000), Some(2000)));
    }
}
