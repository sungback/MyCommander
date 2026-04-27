import { invoke } from "@tauri-apps/api/core";

export const archiveCommands = {
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
};
