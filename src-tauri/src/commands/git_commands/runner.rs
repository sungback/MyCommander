use std::io;
use std::process::{Command, Output};

pub(super) fn run_background_git(path: &str, args: &[&str]) -> io::Result<Output> {
    let mut command = Command::new("git");
    command.arg("-C").arg(path).args(args);
    configure_background_command(&mut command);

    let _error_mode_guard = WindowsThreadErrorModeGuard::suppress_process_error_dialogs();
    command.output()
}

fn configure_background_command(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = command;
    }
}

#[cfg(target_os = "windows")]
struct WindowsThreadErrorModeGuard {
    previous_mode: Option<u32>,
}

#[cfg(target_os = "windows")]
impl WindowsThreadErrorModeGuard {
    fn suppress_process_error_dialogs() -> Self {
        const SEM_FAILCRITICALERRORS: u32 = 0x0001;
        const SEM_NOGPFAULTERRORBOX: u32 = 0x0002;
        const SEM_NOOPENFILEERRORBOX: u32 = 0x8000;

        let mut previous_mode = 0;
        let applied = unsafe {
            SetThreadErrorMode(
                SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX,
                &mut previous_mode,
            )
        } != 0;

        Self {
            previous_mode: applied.then_some(previous_mode),
        }
    }
}

#[cfg(target_os = "windows")]
impl Drop for WindowsThreadErrorModeGuard {
    fn drop(&mut self) {
        if let Some(previous_mode) = self.previous_mode {
            unsafe {
                SetThreadErrorMode(previous_mode, std::ptr::null_mut());
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
struct WindowsThreadErrorModeGuard;

#[cfg(not(target_os = "windows"))]
impl WindowsThreadErrorModeGuard {
    fn suppress_process_error_dialogs() -> Self {
        Self
    }
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn SetThreadErrorMode(dw_new_mode: u32, lp_old_mode: *mut u32) -> i32;
}
