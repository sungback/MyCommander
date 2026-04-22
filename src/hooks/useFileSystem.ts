import { invoke } from "@tauri-apps/api/core";
import { FileEntry } from "../types/file";
import { SyncItem } from "../types/sync";
import { BatchRenameOperation } from "../features/multiRename";
import { JobRecord, JobSubmission } from "../types/job";

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
  | { type: "Finished"; payload: { total_matches: number } };

type TauriJobSubmission =
  | {
      kind: "copy";
      source_paths: string[];
      target_path: string;
      keep_both?: boolean;
    }
  | {
      kind: "move";
      source_paths: string[];
      target_dir: string;
    }
  | {
      kind: "delete";
      paths: string[];
      permanent?: boolean;
    }
  | {
      kind: "zipDirectory";
      path: string;
    }
  | {
      kind: "zipSelection";
      paths: string[];
      target_dir: string;
      archive_name: string;
    };

const toTauriJobSubmission = (job: JobSubmission): TauriJobSubmission => {
  switch (job.kind) {
    case "copy":
      return {
        kind: "copy",
        source_paths: job.sourcePaths,
        target_path: job.targetPath,
        keep_both: job.keepBoth,
      };
    case "move":
      return {
        kind: "move",
        source_paths: job.sourcePaths,
        target_dir: job.targetDir,
      };
    case "delete":
      return {
        kind: "delete",
        paths: job.paths,
        permanent: job.permanent,
      };
    case "zipDirectory":
      return {
        kind: "zipDirectory",
        path: job.path,
      };
    case "zipSelection":
      return {
        kind: "zipSelection",
        paths: job.paths,
        target_dir: job.targetDir,
        archive_name: job.archiveName,
      };
  }
};

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

  submitJob: async (job: JobSubmission): Promise<JobRecord> => {
    return await invoke<JobRecord>("submit_job", { job: toTauriJobSubmission(job) });
  },

  listJobs: async (): Promise<JobRecord[]> => {
    return await invoke<JobRecord[]>("list_jobs");
  },

  cancelJob: async (jobId: string): Promise<JobRecord> => {
    return await invoke<JobRecord>("cancel_job", { job_id: jobId });
  },

  retryJob: async (jobId: string): Promise<JobRecord> => {
    return await invoke<JobRecord>("retry_job", { job_id: jobId });
  },

  clearFinishedJobs: async (): Promise<void> => {
    await invoke("clear_finished_jobs");
  },

  copyFiles: async (
    sourcePaths: string[],
    targetPath: string,
    keepBoth?: boolean
  ): Promise<string[]> => {
    return await invoke<string[]>("copy_files", {
      source_paths: sourcePaths,
      target_path: targetPath,
      keep_both: keepBoth ?? false,
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

  cancelZipOperation: async (): Promise<void> => {
    await invoke("cancel_zip_operation");
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

  compareDirectories: async (
    leftPath: string,
    rightPath: string,
    showHidden: boolean = false
  ): Promise<SyncItem[]> => {
    interface RawSyncItem {
      rel_path: string;
      left_path: string | null;
      right_path: string | null;
      left_kind: "file" | "directory" | null;
      right_kind: "file" | "directory" | null;
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
      show_hidden: showHidden,
    });

    return raw.map((item) => ({
      relPath: item.rel_path,
      leftPath: item.left_path,
      rightPath: item.right_path,
      leftKind: item.left_kind,
      rightKind: item.right_kind,
      status: item.status as any,
      direction: autoDirection(item.status),
    }));
  },

  syncWatchedDirectories: async (paths: string[]): Promise<void> => {
    await invoke("sync_watched_directories", { paths });
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
