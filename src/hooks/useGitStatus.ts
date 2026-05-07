import { useEffect, useRef, useState } from "react";
import { useGitStatusStore, GitStatus } from "../store/gitStatusStore";
import { useFileSystem } from "./useFileSystem";

export const useGitStatus = (path: string | undefined, refreshKey?: number) => {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const prevRefreshKeyRef = useRef(refreshKey);
  const fs = useFileSystem();

  useEffect(() => {
    if (!path) {
      setGitStatus(null);
      return;
    }

    // Invalidate cache when panel was refreshed (refreshKey changed)
    const refreshed = prevRefreshKeyRef.current !== refreshKey;
    prevRefreshKeyRef.current = refreshKey;
    const store = useGitStatusStore.getState();

    if (!refreshed) {
      const cached = store.getCachedStatus(path);
      if (cached.hit) {
        setGitStatus(cached.data);
        return;
      }

      if (store.hasFreshFailure(path)) {
        setGitStatus(null);
        return;
      }
    }

    let cancelled = false;

    const fetchGitStatus = async () => {
      setIsLoading(true);
      let request: Promise<GitStatus | null> | null = null;

      try {
        request = useGitStatusStore.getState().getInFlight(path);
        if (!request) {
          const getGitStatus = fs.getGitStatus;
          if (typeof getGitStatus !== "function") {
            useGitStatusStore.getState().setFailure(path);
            return;
          }

          request = getGitStatus(path);
          useGitStatusStore.getState().setInFlight(path, request);
        }

        const result = await request;

        useGitStatusStore.getState().setStatus(path, result);
        if (!cancelled) {
          setGitStatus(result);
        }
      } catch (error) {
        console.error("Failed to get git status:", error);
        useGitStatusStore.getState().setFailure(path);
        if (!cancelled) {
          setGitStatus(null);
        }
      } finally {
        if (request) {
          useGitStatusStore.getState().clearInFlight(path, request);
        }
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchGitStatus();

    return () => {
      cancelled = true;
    };
  }, [fs, path, refreshKey]);

  return { gitStatus, isLoading };
};
