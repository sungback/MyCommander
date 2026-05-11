import { useEffect, useRef } from "react";
import { useFileSystem } from "../../hooks/useFileSystem";
import type { DirectorySizeStatus, FileEntry, PanelId } from "../../types/file";

const MAX_BACKGROUND_DIR_SIZE_WORKERS = 2;
const DEFAULT_ESTIMATE_OPTIONS = { maxDepth: 1, maxEntries: 200 };
const ROOT_ESTIMATE_OPTIONS = { maxDepth: 0, maxEntries: 100 };

interface BackgroundSizeScheduler {
  activeCount: number;
  queue: Array<{ path: string }>;
  queuedPaths: Set<string>;
  settledPaths: Set<string>;
}

interface UseBackgroundDirSizesProps {
  activeTabId: string;
  currentPath: string;
  files: FileEntry[];
  lastUpdated: number;
  panelId: PanelId;
  setEntrySizeStatus: (
    panel: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  updateEntrySizeEstimate: (
    panel: PanelId,
    path: string,
    size: number,
    status: Extract<DirectorySizeStatus, "estimated" | "partial">
  ) => void;
}

const createScheduler = (): BackgroundSizeScheduler => ({
  activeCount: 0,
  queue: [],
  queuedPaths: new Set(),
  settledPaths: new Set(),
});

export const getAutomaticEstimateOptions = (currentPath: string) => {
  const trimmed = currentPath.replace(/[\\/]+$/, "");
  return trimmed === "" || /^[A-Za-z]:$/.test(trimmed)
    ? ROOT_ESTIMATE_OPTIONS
    : DEFAULT_ESTIMATE_OPTIONS;
};

export const useBackgroundDirSizes = ({
  activeTabId,
  currentPath,
  files,
  lastUpdated,
  panelId,
  setEntrySizeStatus,
  updateEntrySizeEstimate,
}: UseBackgroundDirSizesProps) => {
  const fs = useFileSystem();
  const backgroundSchedulerRef = useRef<BackgroundSizeScheduler>(
    createScheduler()
  );

  useEffect(() => {
    backgroundSchedulerRef.current = createScheduler();
  }, [activeTabId, currentPath, lastUpdated, panelId]);

  useEffect(() => {
    const scheduler = backgroundSchedulerRef.current;
    const estimateOptions = getAutomaticEstimateOptions(currentPath);
    const pendingDirectories = files.filter(
      (entry) =>
        entry.kind === "directory" &&
        entry.name !== ".." &&
        (entry.size === undefined || entry.size === null) &&
        !scheduler.queuedPaths.has(entry.path) &&
        !scheduler.settledPaths.has(entry.path)
    );

    if (pendingDirectories.length === 0) {
      return;
    }

    const drainQueue = () => {
      while (
        scheduler.activeCount < MAX_BACKGROUND_DIR_SIZE_WORKERS &&
        scheduler.queue.length > 0
      ) {
        const entry = scheduler.queue.shift();
        if (!entry) {
          return;
        }

        scheduler.activeCount += 1;
        setEntrySizeStatus(panelId, entry.path, "estimating");

        void fs
          .estimateDirSize(entry.path, estimateOptions)
          .then((estimate) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            scheduler.settledPaths.add(entry.path);
            updateEntrySizeEstimate(
              panelId,
              entry.path,
              estimate.size,
              estimate.isPartial ? "partial" : "estimated"
            );
          })
          .catch((error) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            scheduler.settledPaths.add(entry.path);
            setEntrySizeStatus(panelId, entry.path, "error");
            console.error(
              `Failed to estimate background dir size for ${entry.path}:`,
              error
            );
          })
          .finally(() => {
            scheduler.queuedPaths.delete(entry.path);
            scheduler.activeCount -= 1;

            if (backgroundSchedulerRef.current === scheduler) {
              drainQueue();
            }
          });
      }
    };

    for (const entry of pendingDirectories) {
      scheduler.queue.push({ path: entry.path });
      scheduler.queuedPaths.add(entry.path);
    }

    drainQueue();
  }, [
    currentPath,
    files,
    fs,
    lastUpdated,
    panelId,
    setEntrySizeStatus,
    updateEntrySizeEstimate,
  ]);
};
