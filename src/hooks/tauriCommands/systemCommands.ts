import { invoke } from "@tauri-apps/api/core";
import { ViewMode } from "../../types/file";
import { ThemePreference } from "../../types/theme";

export interface DriveInfo {
  mount_point: string;
  name: string;
  type: string;
  icon: string;
  isEjectable: boolean;
  availableSpace?: number | null;
}

export interface ShowContextMenuRequest {
  x: number;
  y: number;
  hasTargetItem: boolean;
  canRename: boolean;
  canCreateZip: boolean;
  canExtractZip: boolean;
}

export const systemCommands = {
  getDrives: async (): Promise<DriveInfo[]> => {
    try {
      return await invoke<DriveInfo[]>("get_drives");
    } catch (e) {
      console.error("Failed to get drives:", e);
      return [];
    }
  },

  getHomeDir: async (): Promise<string> => {
    try {
      return await invoke<string>("get_home_dir");
    } catch (e) {
      console.error("Failed to get home dir:", e);
      return "/";
    }
  },

  resolvePath: async (path: string): Promise<string> => {
    return await invoke<string>("resolve_path", { path });
  },

  getAvailableSpace: async (path: string): Promise<number | null> => {
    try {
      return await invoke<number>("get_available_space", { path });
    } catch (e) {
      console.error("Failed to get available space:", e);
      return null;
    }
  },

  openInTerminal: async (path: string): Promise<void> => {
    await invoke("open_in_terminal", { path });
  },

  runShellCommand: async (path: string, command: string): Promise<void> => {
    await invoke("run_shell_command", { path, command });
  },

  openInEditor: async (path: string): Promise<void> => {
    await invoke("open_in_editor", { path });
  },

  openFile: async (path: string): Promise<void> => {
    await invoke("open_file", { path });
  },

  quitApp: async (): Promise<void> => {
    await invoke("quit_app");
  },

  writeFilesToPasteboard: async (
    paths: string[],
    operation: "copy" | "cut"
  ): Promise<void> => {
    await invoke("write_files_to_pasteboard", { paths, operation });
  },

  setShowHiddenMenuChecked: async (checked: boolean): Promise<void> => {
    await invoke("set_show_hidden_menu_checked", { checked });
  },

  setThemeMenuSelection: async (theme: ThemePreference): Promise<void> => {
    await invoke("set_theme_menu_selection", { theme });
  },

  setViewModeMenuSelection: async (
    leftMode: ViewMode,
    rightMode: ViewMode
  ): Promise<void> => {
    await invoke("set_view_mode_menu_selection", { leftMode, rightMode });
  },

  showContextMenu: async (request: ShowContextMenuRequest): Promise<void> => {
    await invoke("show_context_menu", {
      request: {
        x: request.x,
        y: request.y,
        has_target_item: request.hasTargetItem,
        can_rename: request.canRename,
        can_create_zip: request.canCreateZip,
        can_extract_zip: request.canExtractZip,
      },
    });
  },
};
