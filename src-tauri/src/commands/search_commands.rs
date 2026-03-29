
use walkdir::WalkDir;
use serde::Serialize;
use glob::Pattern;
use regex::Regex;

#[derive(Serialize)]
pub struct SearchResult {
    name: String,
    path: String,
    size: Option<u64>,
    is_dir: bool,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn search_files(
    start_path: String,
    query: String,
    use_regex: bool,
) -> Result<Vec<SearchResult>, String> {
    let mut results = Vec::new();
    let normalized_query = query.trim().to_lowercase();
    let re = if use_regex {
        Regex::new(&query).ok()
    } else {
        None
    };
    let wildcard_patterns = if use_regex || normalized_query.is_empty() {
        Vec::new()
    } else {
        normalized_query
            .split(';')
            .map(str::trim)
            .filter(|pattern| !pattern.is_empty())
            .filter(|pattern| pattern.contains('*') || pattern.contains('?'))
            .filter_map(|pattern| Pattern::new(pattern).ok())
            .collect::<Vec<_>>()
    };

    for entry in WalkDir::new(&start_path).into_iter().filter_map(|e| e.ok()) {
        let file_name = entry.file_name().to_string_lossy();
        let normalized_file_name = file_name.to_lowercase();
        
        let matches = if use_regex {
            re.as_ref().map(|r| r.is_match(&file_name)).unwrap_or(false)
        } else if !wildcard_patterns.is_empty() {
            wildcard_patterns
                .iter()
                .any(|pattern| pattern.matches(&normalized_file_name))
        } else {
            normalized_file_name.contains(&normalized_query)
        };

        if matches {
            let metadata = entry.metadata().ok();
            results.push(SearchResult {
                name: file_name.into_owned(),
                path: entry.path().to_string_lossy().into_owned(),
                size: metadata.as_ref().map(|m| m.len()),
                is_dir: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            });
            
            // Limit results to prevent UI freezing
            if results.len() > 1000 {
                break;
            }
        }
    }

    Ok(results)
}
