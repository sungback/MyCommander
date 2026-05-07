pub(crate) mod archive;
pub(crate) mod metadata;
pub(crate) mod operations;
pub(crate) mod shared;

pub(crate) use archive::{cancel_zip_operation, create_zip, create_zip_from_paths};
pub(crate) use operations::{
    copy_files_with_cancel_and_progress, delete_files_with_cancel_and_progress,
    move_files_with_cancel_and_progress,
};
pub use shared::ProgressPayload;

#[cfg(test)]
mod tests;
