import { invoke } from "@tauri-apps/api/core";
import { FileEntry } from "../types/file";
import { SyncItem } from "../types/sync";
import { BatchRenameOperation } from "../features/multiRename";

export interface DriveInfo {
  mount_point: string;
  name: string;
  type: string;
  icon: string;
  isEjectable: boolean;
  availableSpace?: number | null;
}

export interface SearchResult {
  name: string;
  path: string;
  size?: number;
  is_dir: boolean;
}

export type SearchEvent =
  | { type: "ResultBatch"; payload: SearchResult[] }
  | { type: "Progress"; payload: { current_dir: string } }
  | { type: "Finished"; payload: { total_matches: number } }
  | { type: "Error"; payload: string };

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

  checkCopyConflicts: async (sourcePaths: string[], targetPath: string): Promise<string[]> => {
    return await invoke<string[]>("check_copy_conflicts", {
      source_paths: sourcePaths,
      target_path: targetPath,
    });
  },

  extractZip: async (path: string): Promise<string> => {
    return await invoke<string>("extract_zip", { path });
  },

  createZip: async (path: string): Promise<string> => {
    return await invoke<string>("create_zip", { path });
  },

  createZipFromPaths: async (
    paths: string[],
    targetDir: string,
    archiveName: string
  ): Promise<string> => {
    return await invoke<string>("create_zip_from_paths", {
      paths,
      target_dir: targetDir,
      archive_name: archiveName,
    });
  },

  renameFile: async (oldPath: string, newPath: string): Promise<void> => {
    await invoke("rename_file", {
      old_path: oldPath,
      new_path: newPath,
    });
  },

  applyBatchRename: async (operations: BatchRenameOperation[]): Promise<void> => {
    await invoke("apply_batch_rename", {
      operations: operations.map((operation) => ({
        old_path: operation.oldPath,
        new_path: operation.newPath,
      })),
    });
  },



  searchFiles: async (
    startPath: string, 
    query: string, 
    useRegex: boolean,
    onEvent: (event: SearchEvent) => void
  ): Promise<void> => {
    const { Channel } = await import("@tauri-apps/api/core");
    const channel = new Channel<SearchEvent>();
    channel.onmessage = onEvent;
    
    await invoke("search_files", {
      start_path: startPath,
      query,
      use_regex: useRegex,
      on_event: channel,
    });
  },

  readFileContent: async (path: string): Promise<string> => {
    return await invoke<string>("read_file_content", { path });
  },

  getDirSize: async (path: string): Promise<number> => {
    return await invoke<number>("get_dir_size", { path });
  },

  compareDirectories: async (leftPath: string, rightPath: string): Promise<SyncItem[]> => {
    interface RawSyncItem {
      rel_path: string;
      left_path: string | null;
      right_path: string | null;
      status: string;
    }

    const autoDirection = (status: string): "toRight" | "toLeft" | "skip" => {
      switch (status) {
        case "LeftOnly":
        case "LeftNewer":
          return "toRight";
        case "RightOnly":
        case "RightNewer":
          return "toLeft";
        default:
          return "skip";
      }
    };

    const raw = await invoke<RawSyncItem[]>("compare_directories", {
      left: leftPath,
      right: rightPath,
    });

    return raw.map((item) => ({
      relPath: item.rel_path,
      leftPath: item.left_path,
      rightPath: item.right_path,
      status: item.status as any,
      direction: autoDirection(item.status),
    }));
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
