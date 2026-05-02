use std::path::{Path, PathBuf};

pub(super) fn make_copy_name(source: &Path, target_dir: &Path) -> PathBuf {
    let file_name = source
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let (stem, ext_with_dot) = if source.is_dir() {
        (file_name.as_str().to_string(), String::new())
    } else {
        match source.extension() {
            Some(ext) => {
                let ext_str = ext.to_string_lossy().to_string();
                let stem_str = source
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                (stem_str, format!(".{ext_str}"))
            }
            None => (file_name.clone(), String::new()),
        }
    };

    let base_stem = {
        let copy_n_re = regex::Regex::new(r"^(.*) copy(?: (\d+))?$").unwrap();
        if let Some(caps) = copy_n_re.captures(&stem) {
            caps.get(1)
                .map(|m| m.as_str().to_string())
                .unwrap_or(stem.clone())
        } else {
            stem.clone()
        }
    };

    let first_candidate = target_dir.join(format!("{base_stem} copy{ext_with_dot}"));
    if !first_candidate.exists() {
        return first_candidate;
    }
    let mut n = 2u32;
    loop {
        let candidate = target_dir.join(format!("{base_stem} copy {n}{ext_with_dot}"));
        if !candidate.exists() {
            return candidate;
        }
        n += 1;
    }
}
