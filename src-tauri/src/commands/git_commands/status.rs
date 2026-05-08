use super::parse::{git_output_to_trimmed_string, git_relative_prefix, parse_git_status_output};
use super::runner::run_background_git;
use super::types::GitStatus;
use std::io;
use std::process::Output;

pub(super) fn get_git_status_for_path(path: &str) -> Result<Option<GitStatus>, String> {
    get_git_status_with_runner(path, run_background_git)
}

pub(super) fn get_git_status_with_runner<F>(
    path: &str,
    mut run_git: F,
) -> Result<Option<GitStatus>, String>
where
    F: FnMut(&str, &[&str]) -> io::Result<Output>,
{
    let root_output =
        match run_successful_git_command(&mut run_git, path, &["rev-parse", "--show-toplevel"]) {
            Some(output) => output,
            None => return Ok(None),
        };
    let git_root = git_output_to_trimmed_string(&root_output);
    let rel_prefix = git_relative_prefix(path, &git_root);

    let status_output = match run_successful_git_command(
        &mut run_git,
        path,
        &["status", "--porcelain", "--branch"],
    ) {
        Some(output) => output,
        None => return Ok(None),
    };

    Ok(Some(parse_git_status_output(
        &status_output.stdout,
        &rel_prefix,
    )))
}

fn run_successful_git_command<F>(run_git: &mut F, path: &str, args: &[&str]) -> Option<Output>
where
    F: FnMut(&str, &[&str]) -> io::Result<Output>,
{
    run_git(path, args)
        .ok()
        .filter(|output| output.status.success())
}
