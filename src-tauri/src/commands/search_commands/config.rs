use glob::Pattern;
use regex::{Regex, RegexBuilder};

const DEFAULT_SEARCH_MAX_RESULTS: usize = 5000;

#[derive(Clone)]
pub(crate) struct SearchConfig {
    pub(crate) query: String,
    pub(crate) use_regex: bool,
    pub(crate) case_sensitive: bool,
    pub(crate) include_hidden: bool,
    pub(crate) scope: String,
    pub(crate) entry_kind: String,
    pub(crate) extensions: Vec<String>,
    pub(crate) min_size_bytes: Option<u64>,
    pub(crate) max_size_bytes: Option<u64>,
    pub(crate) modified_after_ms: Option<u64>,
    pub(crate) modified_before_ms: Option<u64>,
    pub(crate) max_results: usize,
}

impl SearchConfig {
    pub(crate) fn normalized_query(&self) -> String {
        if self.case_sensitive {
            self.query.clone()
        } else {
            self.query.to_lowercase()
        }
    }

    pub(crate) fn from_input(input: SearchConfigInput) -> Self {
        Self {
            query: input.query.trim().to_string(),
            use_regex: input.use_regex,
            case_sensitive: input.case_sensitive.unwrap_or(true),
            include_hidden: input.include_hidden.unwrap_or(true),
            scope: input.scope.unwrap_or_else(|| "name".to_string()),
            entry_kind: input.entry_kind.unwrap_or_else(|| "all".to_string()),
            extensions: normalize_extensions(input.extensions),
            min_size_bytes: input.min_size_bytes,
            max_size_bytes: input.max_size_bytes,
            modified_after_ms: input.modified_after_ms,
            modified_before_ms: input.modified_before_ms,
            max_results: input.max_results.unwrap_or(DEFAULT_SEARCH_MAX_RESULTS),
        }
    }
}

pub(crate) struct SearchConfigInput {
    pub(crate) query: String,
    pub(crate) use_regex: bool,
    pub(crate) case_sensitive: Option<bool>,
    pub(crate) include_hidden: Option<bool>,
    pub(crate) scope: Option<String>,
    pub(crate) entry_kind: Option<String>,
    pub(crate) extensions: Option<Vec<String>>,
    pub(crate) min_size_bytes: Option<u64>,
    pub(crate) max_size_bytes: Option<u64>,
    pub(crate) modified_after_ms: Option<u64>,
    pub(crate) modified_before_ms: Option<u64>,
    pub(crate) max_results: Option<usize>,
}

fn normalize_extensions(extensions: Option<Vec<String>>) -> Vec<String> {
    extensions
        .unwrap_or_default()
        .into_iter()
        .map(|value| value.trim().trim_start_matches('.').to_lowercase())
        .filter(|value| !value.is_empty())
        .collect()
}

pub(crate) fn build_search_regex(query: &str, config: &SearchConfig) -> Option<Regex> {
    if !config.use_regex {
        return None;
    }

    RegexBuilder::new(query)
        .case_insensitive(!config.case_sensitive)
        .build()
        .ok()
}

pub(crate) fn build_wildcard_patterns(config: &SearchConfig) -> Vec<Pattern> {
    if config.use_regex || config.query.is_empty() {
        return Vec::new();
    }

    config
        .query
        .split(';')
        .map(str::trim)
        .filter(|pattern| !pattern.is_empty())
        .filter(|pattern| pattern.contains('*') || pattern.contains('?'))
        .map(|pattern| {
            if config.case_sensitive {
                pattern.to_string()
            } else {
                pattern.to_lowercase()
            }
        })
        .filter_map(|pattern| Pattern::new(&pattern).ok())
        .collect()
}
