use std::path::Path;

use notify::EventKind;

pub(super) fn should_ignore_noisy_metadata_event_path(path: &Path, event_kind: &EventKind) -> bool {
    if is_windows_app_data_descendant(path) {
        return true;
    }

    if is_vcs_metadata_descendant(path) {
        return true;
    }

    is_vcs_metadata_directory(path)
        && !matches!(event_kind, EventKind::Create(_) | EventKind::Remove(_))
}

fn is_vcs_metadata_descendant(path: &Path) -> bool {
    let mut inside_vcs_metadata = false;

    for component in path.components() {
        if inside_vcs_metadata {
            return true;
        }

        inside_vcs_metadata = is_vcs_metadata_name(component.as_os_str());
    }

    false
}

fn is_vcs_metadata_directory(path: &Path) -> bool {
    path.file_name().map(is_vcs_metadata_name).unwrap_or(false)
}

fn is_vcs_metadata_name(name: &std::ffi::OsStr) -> bool {
    name.to_string_lossy().eq_ignore_ascii_case(".git")
}

fn is_windows_app_data_descendant(path: &Path) -> bool {
    let raw_path = path.to_string_lossy();
    let is_windows_like_path =
        raw_path.contains('\\') || raw_path.as_bytes().get(1).is_some_and(|byte| *byte == b':');

    if !is_windows_like_path {
        return false;
    }

    let normalized = raw_path.replace('\\', "/");
    let components: Vec<&str> = normalized
        .split('/')
        .filter(|part| !part.is_empty())
        .collect();

    components
        .iter()
        .position(|component| component.eq_ignore_ascii_case("AppData"))
        .is_some_and(|index| index + 1 < components.len())
}
