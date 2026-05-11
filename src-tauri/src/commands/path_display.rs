use std::borrow::Cow;
use std::path::Path;

pub(crate) fn path_to_display_string(path: &Path) -> String {
    strip_windows_extended_path_prefix(&path.to_string_lossy()).into_owned()
}

fn strip_windows_extended_path_prefix(path: &str) -> Cow<'_, str> {
    if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
        return Cow::Owned(format!(r"\\{rest}"));
    }

    if let Some(rest) = path.strip_prefix(r"\\?\") {
        if is_drive_absolute_path(rest) {
            return Cow::Borrowed(rest);
        }
    }

    Cow::Borrowed(path)
}

fn is_drive_absolute_path(path: &str) -> bool {
    let mut chars = path.chars();
    matches!(chars.next(), Some(letter) if letter.is_ascii_alphabetic())
        && matches!(chars.next(), Some(':'))
        && matches!(chars.next(), Some('\\' | '/'))
}

#[cfg(test)]
mod tests {
    use super::{path_to_display_string, strip_windows_extended_path_prefix};
    use std::path::Path;

    #[test]
    fn strips_windows_drive_extended_prefix() {
        assert_eq!(
            strip_windows_extended_path_prefix(r"\\?\C:\Users\sam\AppData"),
            r"C:\Users\sam\AppData"
        );
    }

    #[test]
    fn strips_windows_unc_extended_prefix() {
        assert_eq!(
            strip_windows_extended_path_prefix(r"\\?\UNC\server\share\folder"),
            r"\\server\share\folder"
        );
    }

    #[test]
    fn keeps_non_extended_paths_unchanged() {
        assert_eq!(
            strip_windows_extended_path_prefix(r"C:\Users\sam"),
            r"C:\Users\sam"
        );
        assert_eq!(
            strip_windows_extended_path_prefix("/Users/sam"),
            "/Users/sam"
        );
    }

    #[test]
    fn keeps_non_drive_extended_paths_unchanged() {
        assert_eq!(
            strip_windows_extended_path_prefix(r"\\?\Volume{123}\folder"),
            r"\\?\Volume{123}\folder"
        );
    }

    #[test]
    fn display_string_strips_extended_prefix() {
        assert_eq!(
            path_to_display_string(Path::new(r"\\?\C:\Users\sam\AppData")),
            r"C:\Users\sam\AppData"
        );
    }
}
