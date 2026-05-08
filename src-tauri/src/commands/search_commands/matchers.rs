use glob::Pattern;
use regex::Regex;

pub(crate) fn matches_query(
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

pub(crate) fn matches_entry_kind(is_dir: bool, entry_kind: &str) -> bool {
    match entry_kind {
        "files" => !is_dir,
        "directories" => is_dir,
        _ => true,
    }
}

pub(crate) fn matches_extensions(file_name: &str, is_dir: bool, extensions: &[String]) -> bool {
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

pub(crate) fn matches_size(
    size: Option<u64>,
    min_size_bytes: Option<u64>,
    max_size_bytes: Option<u64>,
) -> bool {
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

pub(crate) fn matches_modified_range(
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
