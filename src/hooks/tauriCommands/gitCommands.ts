import { invoke } from "@tauri-apps/api/core";
import type { GitStatus } from "../../store/gitStatusStore";

export const gitCommands = {
  getGitStatus: async (path: string): Promise<GitStatus | null> => {
    return await invoke<GitStatus | null>("get_git_status", { path });
  },
};
