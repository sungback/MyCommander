use super::*;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_TEST_ID: AtomicU64 = AtomicU64::new(1);

fn unique_temp_dir(prefix: &str) -> PathBuf {
    let id = NEXT_TEST_ID.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!(
        "mycommander-sync-tests-{prefix}-{}-{id}",
        std::process::id()
    ));
    if dir.exists() {
        let _ = fs::remove_dir_all(&dir);
    }
    fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

#[test]
fn compare_directories_skips_shared_directory_metadata_noise() {
    let left = unique_temp_dir("left");
    let right = unique_temp_dir("right");

    fs::create_dir_all(left.join("docs")).expect("create left docs");
    fs::create_dir_all(right.join("docs")).expect("create right docs");
    fs::write(left.join("docs/report.md"), "left").expect("write left file");
    fs::write(right.join("docs/report.md"), "right").expect("write right file");

    let runtime = tokio::runtime::Runtime::new().expect("create runtime");
    let items = runtime
        .block_on(compare_directories(
            left.to_string_lossy().to_string(),
            right.to_string_lossy().to_string(),
            false,
        ))
        .expect("compare directories");

    assert!(
        items.iter().all(|item| item.rel_path != "docs"),
        "shared directories should not appear as actionable sync rows: {:?}",
        items
            .iter()
            .map(|item| item.rel_path.clone())
            .collect::<Vec<_>>()
    );
    assert!(
        items.iter().any(|item| item.rel_path == "docs/report.md"),
        "changed nested files should still be reported"
    );

    fs::remove_dir_all(left).expect("cleanup left");
    fs::remove_dir_all(right).expect("cleanup right");
}

#[test]
fn compare_directories_accepts_snake_case_invoke_args() {
    let left = unique_temp_dir("invoke-left");
    let right = unique_temp_dir("invoke-right");

    let app = tauri::test::mock_builder()
        .invoke_handler(tauri::generate_handler![compare_directories])
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("build test app");
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("build test webview");

    let response = tauri::test::get_ipc_response(
        &webview,
        tauri::webview::InvokeRequest {
            cmd: "compare_directories".into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().expect("parse invoke url"),
            body: tauri::ipc::InvokeBody::from(serde_json::json!({
                "left": left.to_string_lossy().to_string(),
                "right": right.to_string_lossy().to_string(),
                "show_hidden": false,
            })),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.to_string(),
        },
    );

    assert!(
        response.is_ok(),
        "snake_case invoke payload should be accepted: {response:?}"
    );

    fs::remove_dir_all(left).expect("cleanup left");
    fs::remove_dir_all(right).expect("cleanup right");
}

#[test]
fn compare_directories_hides_hidden_entries_and_descendants_by_default() {
    let left = unique_temp_dir("hidden-left");
    let right = unique_temp_dir("hidden-right");

    fs::create_dir_all(left.join(".claude/worktrees")).expect("create hidden left dir");
    fs::write(left.join(".claude/settings.local.json"), "{}").expect("write hidden config");
    fs::write(left.join(".claude/worktrees/trace.txt"), "secret").expect("write hidden child");
    fs::write(left.join(".DS_Store"), "mac").expect("write ds_store");
    fs::write(left.join("visible.txt"), "visible").expect("write visible file");

    let runtime = tokio::runtime::Runtime::new().expect("create runtime");
    let items = runtime
        .block_on(compare_directories(
            left.to_string_lossy().to_string(),
            right.to_string_lossy().to_string(),
            false,
        ))
        .expect("compare directories");

    let rel_paths = items
        .iter()
        .map(|item| item.rel_path.clone())
        .collect::<Vec<_>>();
    assert_eq!(rel_paths, vec!["visible.txt"]);

    fs::remove_dir_all(left).expect("cleanup left");
    fs::remove_dir_all(right).expect("cleanup right");
}

#[test]
fn compare_directories_collapses_descendants_under_one_sided_directory() {
    let left = unique_temp_dir("collapse-left");
    let right = unique_temp_dir("collapse-right");

    fs::create_dir_all(left.join("docs/nested")).expect("create left docs tree");
    fs::write(left.join("docs/report.md"), "left").expect("write left file");
    fs::write(left.join("docs/nested/a.txt"), "nested").expect("write nested file");

    let runtime = tokio::runtime::Runtime::new().expect("create runtime");
    let items = runtime
        .block_on(compare_directories(
            left.to_string_lossy().to_string(),
            right.to_string_lossy().to_string(),
            false,
        ))
        .expect("compare directories");

    let rel_paths = items
        .iter()
        .map(|item| item.rel_path.clone())
        .collect::<Vec<_>>();
    assert_eq!(rel_paths, vec!["docs"]);

    fs::remove_dir_all(left).expect("cleanup left");
    fs::remove_dir_all(right).expect("cleanup right");
}
