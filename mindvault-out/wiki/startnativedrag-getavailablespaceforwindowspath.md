# start_native_drag & get_available_space_for_windows_path
Cohesion: 0.11 | Nodes: 18

## Key Nodes
- **start_native_drag** (/Users/sungback/Documents/MyCommander/src-tauri/src/commands/drag_commands.rs) -- 13 connections
  - -> calls -> [[unresolvedrefcollectvec]]
  - -> calls -> [[unresolvedreffiltermap]]
  - -> calls -> [[unresolvedrefiter]]
  - -> calls -> [[unresolvedrefinitstr]]
  - -> calls -> [[unresolvedrefnsstringalloc]]
  - -> calls -> [[unresolvedrefnsurlfileurlwithpath]]
  - -> calls -> [[unresolvedrefsome]]
  - -> calls -> [[unresolvedrefisempty]]
  - -> calls -> [[unresolvedrefnsarrayarraywithobjects]]
  - -> calls -> [[unresolvedrefnspasteboardgeneralpasteboard]]
  - -> calls -> [[unresolvedrefnspasteboardpasteboardwithname]]
  - -> calls -> [[unresolvedrefok]]
  - <- contains <- [[dragcommands]]
- **get_available_space_for_windows_path** (/Users/sungback/Documents/MyCommander/src-tauri/src/commands/system_commands.rs) -- 12 connections
  - -> calls -> [[unresolvedrefcollect]]
  - -> calls -> [[unresolvedrefchain]]
  - -> calls -> [[unresolvedrefencodewide]]
  - -> calls -> [[unresolvedrefasosstr]]
  - -> calls -> [[unresolvedrefstditeronce]]
  - -> calls -> [[unresolvedrefmaperr]]
  - -> calls -> [[unresolvedrefmap]]
  - -> calls -> [[unresolvedrefgetdiskfreespaceexw]]
  - -> calls -> [[unresolvedrefpcwstr]]
  - -> calls -> [[unresolvedrefasptr]]
  - -> calls -> [[unresolvedrefsome]]
  - <- contains <- [[systemcommands]]
- **__unresolved__::ref::some** () -- 7 connections
  - <- calls <- [[buildappmenu]]
  - <- calls <- [[run]]
  - <- calls <- [[listdirectory]]
  - <- calls <- [[comparedirectories]]
  - <- calls <- [[startnativedrag]]
  - <- calls <- [[getavailablespaceforwindowspath]]
  - <- calls <- [[buildunixdriveinfo]]
- **__unresolved__::ref::collect___vec____** () -- 2 connections
  - <- calls <- [[searchfiles]]
  - <- calls <- [[startnativedrag]]
- **drag_commands** (/Users/sungback/Documents/MyCommander/src-tauri/src/commands/drag_commands.rs) -- 2 connections
  - -> contains -> [[startnativedrag]]
  - -> imports -> [[unresolvedreftauriruntime]]
- **__unresolved__::ref::as_ptr** () -- 1 connections
  - <- calls <- [[getavailablespaceforwindowspath]]
- **__unresolved__::ref::chain** () -- 1 connections
  - <- calls <- [[getavailablespaceforwindowspath]]
- **__unresolved__::ref::encode_wide** () -- 1 connections
  - <- calls <- [[getavailablespaceforwindowspath]]
- **__unresolved__::ref::getdiskfreespaceexw** () -- 1 connections
  - <- calls <- [[getavailablespaceforwindowspath]]
- **__unresolved__::ref::init_str** () -- 1 connections
  - <- calls <- [[startnativedrag]]
- **__unresolved__::ref::nsarray__arraywithobjects** () -- 1 connections
  - <- calls <- [[startnativedrag]]
- **__unresolved__::ref::nspasteboard__generalpasteboard** () -- 1 connections
  - <- calls <- [[startnativedrag]]
- **__unresolved__::ref::nspasteboard__pasteboardwithname** () -- 1 connections
  - <- calls <- [[startnativedrag]]
- **__unresolved__::ref::nsstring__alloc** () -- 1 connections
  - <- calls <- [[startnativedrag]]
- **__unresolved__::ref::nsurl__fileurlwithpath_** () -- 1 connections
  - <- calls <- [[startnativedrag]]
- **__unresolved__::ref::pcwstr** () -- 1 connections
  - <- calls <- [[getavailablespaceforwindowspath]]
- **__unresolved__::ref::std__iter__once** () -- 1 connections
  - <- calls <- [[getavailablespaceforwindowspath]]
- **__unresolved__::ref::tauri__runtime** () -- 1 connections
  - <- imports <- [[dragcommands]]

## Internal Relationships
- start_native_drag -> calls -> __unresolved__::ref::collect___vec____ [EXTRACTED]
- start_native_drag -> calls -> __unresolved__::ref::init_str [EXTRACTED]
- start_native_drag -> calls -> __unresolved__::ref::nsstring__alloc [EXTRACTED]
- start_native_drag -> calls -> __unresolved__::ref::nsurl__fileurlwithpath_ [EXTRACTED]
- start_native_drag -> calls -> __unresolved__::ref::some [EXTRACTED]
- start_native_drag -> calls -> __unresolved__::ref::nsarray__arraywithobjects [EXTRACTED]
- start_native_drag -> calls -> __unresolved__::ref::nspasteboard__generalpasteboard [EXTRACTED]
- start_native_drag -> calls -> __unresolved__::ref::nspasteboard__pasteboardwithname [EXTRACTED]
- drag_commands -> contains -> start_native_drag [EXTRACTED]
- drag_commands -> imports -> __unresolved__::ref::tauri__runtime [EXTRACTED]
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::chain [EXTRACTED]
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::encode_wide [EXTRACTED]
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::std__iter__once [EXTRACTED]
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::getdiskfreespaceexw [EXTRACTED]
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::pcwstr [EXTRACTED]
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::as_ptr [EXTRACTED]
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::some [EXTRACTED]

## Cross-Community Connections
- start_native_drag -> calls -> __unresolved__::ref::filter_map (-> [[fscommands-unresolvedrefok]])
- start_native_drag -> calls -> __unresolved__::ref::iter (-> [[fscommands-unresolvedrefok]])
- start_native_drag -> calls -> __unresolved__::ref::is_empty (-> [[fscommands-unresolvedrefok]])
- start_native_drag -> calls -> __unresolved__::ref::ok (-> [[fscommands-unresolvedrefok]])
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::collect (-> [[fscommands-unresolvedrefok]])
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::as_os_str (-> [[fscommands-unresolvedrefok]])
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::map_err (-> [[unresolvedreftostring-unresolvedrefmaperr]])
- get_available_space_for_windows_path -> calls -> __unresolved__::ref::map (-> [[fscommands-unresolvedrefok]])

## Context
이 커뮤니티는 start_native_drag, get_available_space_for_windows_path, __unresolved__::ref::some를 중심으로 calls 관계로 연결되어 있다. 주요 소스 파일은 drag_commands.rs, system_commands.rs이다.

### Key Facts
- [tauri::command] pub async fn start_native_drag<R: Runtime>( _app: tauri::AppHandle<R>, _window: tauri::Window<R>, paths: Vec<String>, ) -> Result<(), String> { #[cfg(target_os = "macos")] #[allow(deprecated)] { use cocoa::appkit::NSPasteboard; use cocoa::base::nil; use cocoa::foundation::{NSArray,…
- [cfg(target_os = "windows")] { return get_available_space_for_windows_path(&resolved_path); }
