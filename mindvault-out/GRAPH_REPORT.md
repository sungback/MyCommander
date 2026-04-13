# MindVault Graph Report
Generated: 2026-04-13 08:14:17
Source: /Users/sungback/Documents/MyCommander

## Overview
- Nodes: 532
- Edges: 1101
- Communities: 23
- Source files: 82 (34669 words)

## Communities
| # | Label | Nodes | Cohesion |
|---|-------|-------|----------|
| 0 | fs_commands & __unresolved__::ref::ok | 126 | 0.04 |
| 1 | App & __unresolved__::ref::_react_ | 119 | 0.03 |
| 2 | __unresolved__::ref::to_string & __unresolved__::ref::map_err | 69 | 0.04 |
| 3 | system_commands & run_shell_command_for_path | 53 | 0.05 |
| 4 | App & __unresolved__::ref::addeventlistener | 39 | 0.05 |
| 5 | run & set_view_mode_menu_selection | 37 | 0.09 |
| 6 | compare_directories & sync_commands | 23 | 0.09 |
| 7 | start_native_drag & get_available_space_for_windows_path | 18 | 0.11 |
| 8 | panelStore & __unresolved__::ref::_zustand_ | 11 | 0.18 |
| 9 | bash & MyCommander 🚀 | 7 | 0.48 |
| 10 | vite.config & __unresolved__::ref::__vitejs_plugin_react_ | 6 | 0.33 |
| 11 | move_to_trash & __unresolved__::ref::delete | 5 | 0.40 |
| 12 | MyCommander — CLAUDE.md & bash | 4 | 0.67 |
| 13 | main & __unresolved__::ref::my_commander_lib__run | 3 | 0.67 |
| 14 | format & __unresolved__::ref::_date_fns_ | 3 | 0.67 |
| 15 | __unresolved__::ref::__testing_library_jest_dom_ & setup | 2 | 1.00 |
| 16 | mod | 1 | 1.00 |
| 17 | vite-env.d | 1 | 1.00 |
| 18 | file | 1 | 1.00 |
| 19 | theme | 1 | 1.00 |
| 20 | sync | 1 | 1.00 |
| 21 | path | 1 | 1.00 |
| 22 | clipboard | 1 | 1.00 |

## God Nodes
| Node | Connections | Source |
|------|------------|--------|
| __unresolved__::ref::to_string | 45 |  |
| fs_commands | 44 | /Users/sungback/Documents/MyCommander/src-tauri/src/commands/fs_commands.rs |
| App | 39 | /Users/sungback/Documents/MyCommander/src/App.tsx |
| __unresolved__::ref::map_err | 39 |  |
| __unresolved__::ref::ok | 34 |  |

## Surprising Connections
- **dialogStore** -> imports -> **__unresolved__::ref::_zustand_**
  Communities: App & __unresolved__::ref::_react_ <-> panelStore & __unresolved__::ref::_zustand_
- **create_directory** -> calls -> **__unresolved__::ref::fs__create_dir_all**
  Communities: __unresolved__::ref::to_string & __unresolved__::ref::map_err <-> fs_commands & __unresolved__::ref::ok
- **drive_name_for_mount** -> calls -> **__unresolved__::ref::or_else**
  Communities: fs_commands & __unresolved__::ref::ok <-> run & set_view_mode_menu_selection
- **get_available_space_for_windows_path** -> calls -> **__unresolved__::ref::collect**
  Communities: start_native_drag & get_available_space_for_windows_path <-> fs_commands & __unresolved__::ref::ok
- **get_available_space_for_windows_path** -> calls -> **__unresolved__::ref::as_os_str**
  Communities: start_native_drag & get_available_space_for_windows_path <-> fs_commands & __unresolved__::ref::ok

## Suggested Questions
1. How does fs_commands & __unresolved__::ref::ok relate to App & __unresolved__::ref::_react_?
2. How does fs_commands & __unresolved__::ref::ok relate to __unresolved__::ref::to_string & __unresolved__::ref::map_err?
3. How does fs_commands & __unresolved__::ref::ok relate to system_commands & run_shell_command_for_path?
4. How does fs_commands & __unresolved__::ref::ok relate to App & __unresolved__::ref::addeventlistener?
5. How does fs_commands & __unresolved__::ref::ok relate to run & set_view_mode_menu_selection?
