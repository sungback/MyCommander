use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn create_test_dir(name: &str) -> PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("mycommander_{name}_{suffix}"))
}

mod archive;
mod metadata;
mod operations;
mod shared;
