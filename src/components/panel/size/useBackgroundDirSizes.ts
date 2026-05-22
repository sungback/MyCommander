import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useFileSystem } from "../../../hooks/useFileSystem";
import type { DirectorySizeProgressEvent } from "../../../hooks/tauriCommands/fileCommands";
import type { DirectorySizeStatus, FileEntry, PanelId } from "../../../types/file";

const MAX_BACKGROUND_DIR_SIZE_WORKERS = 2;
const MAX_BACKGROUND_EXACT_WORKERS = 1;
const DEFAULT_ESTIMATE_OPTIONS = { maxDepth: 1, maxEntries: 200 };
const ROOT_ESTIMATE_OPTIONS = { maxDepth: 0, maxEntries: 100 };
const CLOUD_STORAGE_PATH_MARKERS = [
  "cloudstorage",
  "drivefs",
  "dropbox",
  "google drive",
  "icloud drive",
  "iclouddrive",
  "my drive",
  "onedrive",
  "shared drives",
  "공유 드라이브",
  "내 드라이브",
];
const VOLATILE_AUTO_SCAN_PATH_COMPONENTS = [
  "appdata",
];

interface BackgroundSizeScheduler {
  activeCount: number;
  queue: Array<{ path: string }>;
  queuedPaths: Set<string>;
  settledPaths: Set<string>;
  activeExactCount: number;
  exactQueue: Array<{ attemptKey: string; path: string }>;
  queuedExactPaths: Set<string>;
  settledExactPaths: Set<string>;
  activeExactScans: Map<string, string>;
}

interface UseBackgroundDirSizesProps {
  activeTabId: string;
  currentPath: string;
  files: FileEntry[];
  lastUpdated: number;
  panelId: PanelId;
  sizeCacheStale: Record<string, boolean>;
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
  updateEntrySize: (panel: PanelId, path: string, size: number) => void;
  updateEntrySizeProgress: (
    panel: PanelId,
    path: string,
    size: number
  ) => void;
}

const createScheduler = (): BackgroundSizeScheduler => ({
  activeCount: 0,
  queue: [],
  queuedPaths: new Set(),
  settledPaths: new Set(),
  activeExactCount: 0,
  exactQueue: [],
  queuedExactPaths: new Set(),
  settledExactPaths: new Set(),
  activeExactScans: new Map(),
});

const getExactAttemptKey = (entry: FileEntry, isStale: boolean) =>
  [
    entry.path.normalize("NFC"),
    entry.size ?? "",
    entry.sizeStatus ?? "",
    isStale ? "stale" : "fresh",
  ].join("|");

export const getAutomaticEstimateOptions = (currentPath: string) => {
  const trimmed = currentPath.replace(/[\\/]+$/, "");
  return trimmed === "" || /^[A-Za-z]:$/.test(trimmed)
    ? ROOT_ESTIMATE_OPTIONS
    : DEFAULT_ESTIMATE_OPTIONS;
};

export const isLikelyCloudStoragePath = (path: string) => {
  const normalized = path
    .replace(/[\\/]+/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/")
    .toLowerCase();

  return CLOUD_STORAGE_PATH_MARKERS.some((marker) =>
    normalized.includes(marker.toLowerCase())
  );
};

export const isLikelyVolatileAutoScanPath = (path: string) => {
  if (!path.includes("\\") && !/^[A-Za-z]:[\\/]/.test(path)) {
    return false;
  }

  const components = path
    .replace(/[\\/]+/g, "/")
    .split("/")
    .filter(Boolean)
    .map((component) => component.toLowerCase());

  return VOLATILE_AUTO_SCAN_PATH_COMPONENTS.some((component) =>
    components.includes(component)
  );
};

export const shouldAutoScanExactSizes = (currentPath: string) =>
  getAutomaticEstimateOptions(currentPath) !== ROOT_ESTIMATE_OPTIONS &&
  !isLikelyCloudStoragePath(currentPath) &&
  !isLikelyVolatileAutoScanPath(currentPath);

export const shouldQueueExactBackgroundScan = (
  entry: FileEntry,
  isStale: boolean
) => {
  if (entry.kind !== "directory" || entry.name === "..") {
    return false;
  }

  if (isLikelyCloudStoragePath(entry.path)) {
    return false;
  }

  if (isLikelyVolatileAutoScanPath(entry.path)) {
    return false;
  }

  return entry.sizeStatus === "estimated" || entry.sizeStatus === "partial" || isStale;
};

export const useBackgroundDirSizes = ({
  activeTabId,
  currentPath,
  files,
  lastUpdated,
  panelId,
  sizeCacheStale,
  setEntrySizeStatus,
  updateEntrySizeEstimate,
  updateEntrySize,
  updateEntrySizeProgress,
}: UseBackgroundDirSizesProps) => {
  const fs = useFileSystem();
  const scanCounterRef = useRef(0);
  const attemptedExactKeysRef = useRef(new Set<string>());
  const backgroundSchedulerRef = useRef<BackgroundSizeScheduler>(
    createScheduler()
  );

  useEffect(() => {
    attemptedExactKeysRef.current = new Set();
  }, [activeTabId, currentPath, panelId]);

  useEffect(() => {
    const previousScheduler = backgroundSchedulerRef.current;
    for (const scanId of previousScheduler.activeExactScans.keys()) {
      void fs.cancelDirSizeScan(scanId);
    }

    backgroundSchedulerRef.current = createScheduler();
  }, [activeTabId, currentPath, lastUpdated, panelId]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen<DirectorySizeProgressEvent>("dir-size-progress", (event) => {
      if (disposed || event.payload.completed) {
        return;
      }

      const scheduler = backgroundSchedulerRef.current;
      const path = scheduler.activeExactScans.get(event.payload.scanId);
      if (!path || path !== event.payload.path) {
        return;
      }

      updateEntrySizeProgress(panelId, path, event.payload.size);
    }).then((unsubscribe) => {
      if (disposed) {
        unsubscribe();
      } else {
        unlisten = unsubscribe;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [panelId, updateEntrySizeProgress]);

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

  useEffect(() => {
    if (!shouldAutoScanExactSizes(currentPath)) {
      return;
    }

    const scheduler = backgroundSchedulerRef.current;
    const isStale = (path: string) => Boolean(sizeCacheStale[path.normalize("NFC")]);
    const pendingDirectories = files.filter(
      (entry) => {
        const stale = isStale(entry.path);
        const attemptKey = getExactAttemptKey(entry, stale);
        return (
          shouldQueueExactBackgroundScan(entry, stale) &&
          !scheduler.queuedExactPaths.has(entry.path) &&
          !attemptedExactKeysRef.current.has(attemptKey) &&
          !scheduler.settledExactPaths.has(entry.path)
        );
      }
    );

    if (pendingDirectories.length === 0) {
      return;
    }

    const drainExactQueue = () => {
      while (
        scheduler.activeExactCount < MAX_BACKGROUND_EXACT_WORKERS &&
        scheduler.exactQueue.length > 0
      ) {
        const queuedEntry = scheduler.exactQueue.shift();
        if (!queuedEntry) {
          return;
        }

        scheduler.activeExactCount += 1;
        const scanId = `${panelId}-${Date.now()}-${scanCounterRef.current++}`;
        scheduler.activeExactScans.set(scanId, queuedEntry.path);
        setEntrySizeStatus(panelId, queuedEntry.path, "calculating");

        void fs
          .scanDirSize(queuedEntry.path, scanId)
          .then((result) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            scheduler.settledExactPaths.add(queuedEntry.path);
            if (result.isPartial) {
              updateEntrySizeEstimate(panelId, queuedEntry.path, result.size, "partial");
            } else {
              updateEntrySize(panelId, queuedEntry.path, result.size);
            }
          })
          .catch((error) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            scheduler.settledExactPaths.add(queuedEntry.path);
            setEntrySizeStatus(panelId, queuedEntry.path, "error");
            console.error(
              `Failed to scan background dir size for ${queuedEntry.path}:`,
              error
            );
          })
          .finally(() => {
            scheduler.activeExactScans.delete(scanId);
            scheduler.queuedExactPaths.delete(queuedEntry.path);
            scheduler.activeExactCount -= 1;

            if (backgroundSchedulerRef.current === scheduler) {
              drainExactQueue();
            }
          });
      }
    };

    for (const entry of pendingDirectories) {
      const stale = isStale(entry.path);
      const attemptKey = getExactAttemptKey(entry, stale);
      scheduler.exactQueue.push({ attemptKey, path: entry.path });
      scheduler.queuedExactPaths.add(entry.path);
      attemptedExactKeysRef.current.add(attemptKey);
    }

    drainExactQueue();
  }, [
    currentPath,
    files,
    fs,
    lastUpdated,
    panelId,
    sizeCacheStale,
    setEntrySizeStatus,
    updateEntrySize,
    updateEntrySizeEstimate,
  ]);
};
