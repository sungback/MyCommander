import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef } from "react";
import { usePanelStore } from "../store/panelStore";
import { refreshPanelsForDirectories } from "../store/panelRefresh";
import { collectWatchDirectories } from "../store/panelWatch";
import { useFileSystem } from "./useFileSystem";
import { getPathDirectoryName, normalizePathForComparison } from "../utils/path";

const REFRESH_DEBOUNCE_MS = 120;

interface FileSystemChangedPayload {
  directories?: string[];
  paths?: string[];
}

const buildWatchSignature = (paths: string[]) =>
  paths
    .map((path) => normalizePathForComparison(path))
    .sort()
    .join("|");

export const useDirectoryWatch = () => {
  const fs = useFileSystem();
  const leftPanel = usePanelStore((state) => state.leftPanel);
  const rightPanel = usePanelStore((state) => state.rightPanel);
  const watchedDirectories = useMemo(
    () => collectWatchDirectories([leftPanel, rightPanel]),
    [leftPanel, rightPanel]
  );
  const watchSignature = useMemo(() => buildWatchSignature(watchedDirectories), [watchedDirectories]);
  const lastSyncedSignatureRef = useRef("");

  useEffect(() => {
    if (watchSignature === lastSyncedSignatureRef.current) {
      return;
    }

    lastSyncedSignatureRef.current = watchSignature;

    let cancelled = false;
    void fs.syncWatchedDirectories(watchedDirectories).catch((error) => {
      if (!cancelled) {
        console.error("Failed to sync watched directories:", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fs, watchSignature, watchedDirectories]);

  useEffect(() => {
    let isMounted = true;
    let refreshTimer: number | undefined;
    const pendingDirectories = new Set<string>();

    const queueDirectory = (path: string) => {
      if (!path) {
        return;
      }
      pendingDirectories.add(path);
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        if (!isMounted || pendingDirectories.size === 0) {
          return;
        }

        const directories = Array.from(pendingDirectories);
        pendingDirectories.clear();
        refreshPanelsForDirectories(directories);
      }, REFRESH_DEBOUNCE_MS);
    };

    const attachListener = async () => {
      const unlisten = await listen<FileSystemChangedPayload>("filesystem-changed", (event) => {
        if (!isMounted) {
          return;
        }

        for (const directory of event.payload.directories ?? []) {
          queueDirectory(directory);
        }

        for (const changedPath of event.payload.paths ?? []) {
          queueDirectory(changedPath);
          queueDirectory(getPathDirectoryName(changedPath));
        }

        scheduleRefresh();
      });

      if (!isMounted) {
        unlisten();
      }

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    void attachListener().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
      pendingDirectories.clear();
      cleanup?.();
    };
  }, []);

  useEffect(
    () => () => {
      void fs.syncWatchedDirectories([]).catch((error) => {
        console.error("Failed to clear watched directories:", error);
      });
    },
    [fs]
  );
};
