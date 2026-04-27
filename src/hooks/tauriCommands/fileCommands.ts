import { invoke } from "@tauri-apps/api/core";
import { FileEntry } from "../../types/file";
import { BatchRenameOperation } from "../../features/multiRename";

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
    await invoke("delete_files", { paths, permanent });
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
};
