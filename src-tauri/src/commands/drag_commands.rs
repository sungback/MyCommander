use tauri::Runtime;

#[tauri::command]
pub async fn start_native_drag<R: Runtime>(
    _app: tauri::AppHandle<R>,
    _window: tauri::Window<R>,
    paths: Vec<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    #[allow(deprecated)]
    {
        use cocoa::appkit::NSPasteboard;
        use cocoa::base::nil;
        use cocoa::foundation::{NSArray, NSString, NSURL};
        use objc::{msg_send, sel, sel_impl};

        unsafe {
            let urls = paths
                .iter()
                .filter_map(|p| {
                    let path_str = NSString::alloc(nil).init_str(p);
                    let url = NSURL::fileURLWithPath_(nil, path_str);
                    if url == nil {
                        None
                    } else {
                        Some(url)
                    }
                })
                .collect::<Vec<_>>();

            if !urls.is_empty() {
                let nspaths = NSArray::arrayWithObjects(nil, &urls);

                // 1. General Pasteboard
                let gen_pb = NSPasteboard::generalPasteboard(nil);
                if gen_pb != nil {
                    let _: () = msg_send![gen_pb, clearContents];
                    let _: bool = msg_send![gen_pb, writeObjects: nspaths];
                }

                // 2. Drag Pasteboard ("apple.drag")
                let drag_pb_name = NSString::alloc(nil).init_str("apple.drag");
                let drag_pb = NSPasteboard::pasteboardWithName(nil, drag_pb_name);
                if drag_pb != nil {
                    let _: () = msg_send![drag_pb, clearContents];
                    let _: bool = msg_send![drag_pb, writeObjects: nspaths];
                }
            }
        }
    }

    Ok(())
}

/// 시스템 클립보드(NSPasteboard)에 파일 경로를 기록합니다.
/// operation: "copy" | "cut"
/// Finder 등 외부 앱에서 Cmd+V로 붙여넣기 가능하게 합니다.
#[tauri::command]
pub async fn write_files_to_pasteboard(
    paths: Vec<String>,
    operation: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    #[allow(deprecated)]
    {
        use cocoa::appkit::NSPasteboard;
        use cocoa::base::nil;
        use cocoa::foundation::{NSArray, NSString, NSURL};
        use objc::{msg_send, sel, sel_impl};

        unsafe {
            let urls: Vec<_> = paths
                .iter()
                .filter_map(|p| {
                    let path_str = NSString::alloc(nil).init_str(p);
                    let url = NSURL::fileURLWithPath_(nil, path_str);
                    if url == nil {
                        None
                    } else {
                        Some(url)
                    }
                })
                .collect();

            if urls.is_empty() {
                return Ok(());
            }

            let nspaths = NSArray::arrayWithObjects(nil, &urls);
            let gen_pb = NSPasteboard::generalPasteboard(nil);
            if gen_pb == nil {
                return Err("NSPasteboard를 가져올 수 없습니다".to_string());
            }

            let _: () = msg_send![gen_pb, clearContents];
            let _: bool = msg_send![gen_pb, writeObjects: nspaths];

            // cut 작업인 경우 Finder가 인식하는 잘라내기 마킹 추가
            // com.apple.finder.pasteboard-operation = "cut"
            if operation == "cut" {
                let type_str =
                    NSString::alloc(nil).init_str("com.apple.finder.pasteboard-operation");
                let val_str = NSString::alloc(nil).init_str("cut");
                let _: () = msg_send![gen_pb, setString: val_str forType: type_str];
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Windows / Linux: 향후 구현
        let _ = (paths, operation);
    }

    Ok(())
}
