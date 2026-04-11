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
        use cocoa::foundation::{NSArray, NSURL, NSString};
        use objc::{msg_send, sel, sel_impl};

        unsafe {
            let urls = paths
                .iter()
                .filter_map(|p| {
                    let path_str = NSString::alloc(nil).init_str(p);
                    let url = NSURL::fileURLWithPath_(nil, path_str);
                    if url == nil { None } else { Some(url) }
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
