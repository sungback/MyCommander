import { invoke } from "@tauri-apps/api/core";
import { SyncItem } from "../../types/sync";

export const syncCommands = {
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
