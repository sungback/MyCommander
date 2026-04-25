import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGitStatusStore, GitStatus } from "../store/gitStatusStore";

export const useGitStatus = (path: string | undefined, refreshKey?: number) => {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const prevRefreshKeyRef = useRef(refreshKey);

  useEffect(() => {
    if (!path) {
      setGitStatus(null);
      return;
    }

    // Invalidate cache when panel was refreshed (refreshKey changed)
    const refreshed = prevRefreshKeyRef.current !== refreshKey;
    prevRefreshKeyRef.current = refreshKey;

    if (!refreshed) {
      // Try cache first
      const cached = useGitStatusStore.getState().getStatus(path);
      if (cached) {
        setGitStatus(cached);
        return;
      }
    }

    // Fetch from backend
    const fetchGitStatus = async () => {
      setIsLoading(true);
      try {
        const result = await invoke<GitStatus | null>("get_git_status", {
          path,
        });

        if (result) {
          useGitStatusStore.getState().setStatus(path, result);
          setGitStatus(result);
        } else {
          setGitStatus(null);
        }
      } catch (error) {
        console.error("Failed to get git status:", error);
        setGitStatus(null);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchGitStatus();
  }, [path, refreshKey]);

  return { gitStatus, isLoading };
};
