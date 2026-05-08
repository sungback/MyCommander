use serde::Serialize;
use tauri::ipc::Channel;

#[path = "search_commands/config.rs"]
mod config;
#[path = "search_commands/matchers.rs"]
mod matchers;
#[path = "search_commands/runner.rs"]
mod runner;

use config::{build_search_regex, build_wildcard_patterns, SearchConfig, SearchConfigInput};

#[cfg(test)]
pub(crate) use matchers::{
    matches_entry_kind, matches_extensions, matches_modified_range, matches_query, matches_size,
};

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

#[allow(clippy::too_many_arguments)]
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
    let raw_query = query.clone();
    let config = SearchConfig::from_input(SearchConfigInput {
        query,
        use_regex,
        case_sensitive,
        include_hidden,
        scope,
        entry_kind,
        extensions,
        min_size_bytes,
        max_size_bytes,
        modified_after_ms,
        modified_before_ms,
        max_results,
    });
    let re = build_search_regex(&raw_query, &config);
    let wildcard_patterns = build_wildcard_patterns(&config);

    tokio::task::spawn_blocking(move || {
        runner::run_search(start_path, config, re, wildcard_patterns, on_event);
    });

    Ok(())
}

#[cfg(test)]
#[path = "search_commands_tests.rs"]
mod search_commands_tests;
