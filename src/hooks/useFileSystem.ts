import { invoke } from "@tauri-apps/api/core";
import { FileEntry } from "../types/file";

export interface DriveInfo {
  mount_point: string;
  name: string;
  drive_type: string;
}

export interface SearchResult {
  name: string;
  path: string;
  size?: number;
  is_dir: boolean;
}

const fileSystem = {
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
      return "/"; // Fail-safe
    }
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

  openInEditor: async (path: string): Promise<void> => {
    await invoke("open_in_editor", { path });
  },

  quitApp: async (): Promise<void> => {
    await invoke("quit_app");
  },

  listDirectory: async (path: string, showHidden: boolean = false): Promise<FileEntry[]> => {
    try {
      return await invoke<FileEntry[]>("list_directory", { path, show_hidden: showHidden });
    } catch (e) {
      console.error("Failed to list directory:", e);
      throw e;
    }
  },

  createDirectory: async (path: string): Promise<void> => {
    await invoke("create_directory", { path });
  },

  createFile: async (path: string): Promise<void> => {
    await invoke("create_file", { path });
  },

  deleteFiles: async (paths: string[], permanent: boolean = false): Promise<void> => {
    await invoke("delete_files", { paths, permanent });
  },

  copyFiles: async (sourcePaths: string[], targetPath: string): Promise<void> => {
    await invoke("copy_files", {
      source_paths: sourcePaths,
      target_path: targetPath,
    });
  },

  moveFiles: async (sourcePaths: string[], targetDir: string): Promise<void> => {
    await invoke("move_files", {
      source_paths: sourcePaths,
      target_dir: targetDir,
    });
  },

  renameFile: async (oldPath: string, newPath: string): Promise<void> => {
    await invoke("rename_file", {
      old_path: oldPath,
      new_path: newPath,
    });
  },

  searchFiles: async (startPath: string, query: string, useRegex: boolean = false): Promise<SearchResult[]> => {
    return await invoke<SearchResult[]>("search_files", {
      start_path: startPath,
      query,
      use_regex: useRegex,
    });
  },

  readFileContent: async (path: string): Promise<string> => {
    return await invoke<string>("read_file_content", { path });
  },

  getDirSize: async (path: string): Promise<number> => {
    return await invoke<number>("get_dir_size", { path });
  },
};

export function useFileSystem() {
  return fileSystem;
}

export function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const message = Reflect.get(error, "message");
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallbackMessage;
}
