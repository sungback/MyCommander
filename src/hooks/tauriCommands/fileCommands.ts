import { invoke } from "@tauri-apps/api/core";
import { BatchRenameOperation } from "../../features/multiRename";
import type { DirectorySizeStatus, FileEntry } from "../../types/file";

export type PersistentDirectorySizeStatus = Extract<
  DirectorySizeStatus,
  "exact" | "estimated" | "partial"
>;

export interface DirectorySizeEstimate {
  size: number;
  isPartial: boolean;
  scannedEntries: number;
}

export interface DirectorySizeScanResult {
  size: number;
  isPartial: boolean;
  scannedEntries: number;
  errorCount: number;
}

export interface DirectorySizeProgressEvent {
  scanId: string;
  path: string;
  size: number;
  isPartial: boolean;
  scannedEntries: number;
  completed: boolean;
}

export interface PersistentDirectorySizeCacheEntry {
  path: string;
  size: number;
  status: PersistentDirectorySizeStatus;
  scannedAt: number;
  lastUsedAt: number;
  isStale: boolean;
}

export interface PersistentDirectorySizeCacheUpdate {
  path: string;
  size: number;
  status: PersistentDirectorySizeStatus;
  scannedAt?: number;
  lastUsedAt?: number;
}

interface DirectorySizeEstimateResponse {
  size: number;
  isPartial: boolean;
  scannedEntries: number;
}

interface DirectorySizeScanResponse {
  size: number;
  isPartial: boolean;
  scannedEntries: number;
  errorCount: number;
}

interface PersistentDirectorySizeCacheLoadResponse {
  version: number;
  entries: PersistentDirectorySizeCacheEntry[];
  loadedAt: number;
}

export const fileCommands = {
  listDirectory: async (
    path: string,
    showHidden: boolean = false
  ): Promise<FileEntry[]> => {
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
    await invoke("delete_files", {
      paths,
      permanent,
      confirmed_path_count: permanent ? paths.length : undefined,
    });
  },

  copyFiles: async (
    sourcePaths: string[],
    targetPath: string,
    keepBoth?: boolean,
    overwrite?: boolean
  ): Promise<string[]> => {
    return await invoke<string[]>("copy_files", {
      source_paths: sourcePaths,
      target_path: targetPath,
      keep_both: keepBoth ?? false,
      overwrite: overwrite ?? false,
    });
  },

  moveFiles: async (
    sourcePaths: string[],
    targetDir: string,
    overwrite: boolean = false
  ): Promise<void> => {
    await invoke("move_files", {
      source_paths: sourcePaths,
      target_dir: targetDir,
      ...(overwrite ? { overwrite: true } : {}),
    });
  },

  checkCopyConflicts: async (
    sourcePaths: string[],
    targetPath: string
  ): Promise<string[]> => {
    return await invoke<string[]>("check_copy_conflicts", {
      source_paths: sourcePaths,
      target_path: targetPath,
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

  readFileContent: async (path: string): Promise<string> => {
    return await invoke<string>("read_file_content", { path });
  },

  getDirSize: async (path: string): Promise<number> => {
    return await invoke<number>("get_dir_size", { path });
  },

  estimateDirSize: async (
    path: string,
    options: { maxDepth?: number; maxEntries?: number } = {}
  ): Promise<DirectorySizeEstimate> => {
    const result = await invoke<DirectorySizeEstimateResponse>("estimate_dir_size", {
      path,
      max_depth: options.maxDepth,
      max_entries: options.maxEntries,
    });

    return {
      size: result.size,
      isPartial: result.isPartial,
      scannedEntries: result.scannedEntries,
    };
  },

  scanDirSize: async (
    path: string,
    scanId: string
  ): Promise<DirectorySizeScanResult> => {
    const result = await invoke<DirectorySizeScanResponse>("scan_dir_size", {
      path,
      scan_id: scanId,
    });

    return {
      size: result.size,
      isPartial: result.isPartial,
      scannedEntries: result.scannedEntries,
      errorCount: result.errorCount,
    };
  },

  cancelDirSizeScan: async (scanId: string): Promise<void> => {
    await invoke("cancel_dir_size_scan", { scan_id: scanId });
  },

  loadDirSizeCache: async (): Promise<PersistentDirectorySizeCacheEntry[]> => {
    const result = await invoke<PersistentDirectorySizeCacheLoadResponse>(
      "load_dir_size_cache"
    );

    return result.entries;
  },

  upsertDirSizeCacheEntries: async (
    entries: PersistentDirectorySizeCacheUpdate[]
  ): Promise<void> => {
    await invoke("upsert_dir_size_cache_entries", { entries });
  },

  deleteDirSizeCacheEntries: async (paths: string[]): Promise<void> => {
    await invoke("delete_dir_size_cache_entries", { paths });
  },
};
