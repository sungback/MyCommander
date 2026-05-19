import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef } from "react";
import { usePanelStore } from "../store/panelStore";
import {
  refreshPanelsForDirectories,
  refreshPanelsForEntryPaths,
} from "../store/panelRefresh";
import { collectWatchDirectories } from "../store/panelWatch";
import { useGitStatusStore } from "../store/gitStatusStore";
import { showTransientToast } from "../store/toastStore";
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
        showTransientToast("폴더 변경 감시를 갱신하지 못했습니다.", {
          tone: "warning",
          durationMs: 2500,
        });
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
    const pendingPaths = new Set<string>();

    const queueDirectory = (path: string) => {
      if (!path) {
        return;
      }
      pendingDirectories.add(path);
    };

    const queuePath = (path: string) => {
      if (!path) {
        return;
      }
      pendingPaths.add(path);
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        if (!isMounted || (pendingDirectories.size === 0 && pendingPaths.size === 0)) {
          return;
        }

        const paths = Array.from(pendingPaths);
        const directories = Array.from(pendingDirectories);
        pendingPaths.clear();
        pendingDirectories.clear();

        const { clearFailure } = useGitStatusStore.getState();
        for (const dir of directories) {
          clearFailure(dir);
        }

        if (paths.length > 0) {
          refreshPanelsForEntryPaths(paths, "filesystem-changed");
        }

        refreshPanelsForDirectories(directories, "filesystem-changed");
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
          queuePath(changedPath);
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
      pendingPaths.clear();
      pendingDirectories.clear();
      cleanup?.();
    };
  }, []);

  useEffect(
    () => () => {
      void fs.syncWatchedDirectories([]).catch((error) => {
        console.error("Failed to clear watched directories:", error);
        showTransientToast("폴더 변경 감시를 정리하지 못했습니다.", {
          tone: "warning",
          durationMs: 2500,
        });
      });
    },
    [fs]
  );
};
