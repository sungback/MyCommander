import type { DirectorySizeStatus, FileEntry, PanelId } from "../../../types/file";
import type {
  DirectorySizeEstimate,
  DirectorySizeScanResult,
} from "../../../hooks/tauriCommands/fileCommands";
import {
  CLOUD_BOUNDED_ESTIMATE_OPTIONS,
  getAutomaticEstimateOptions,
  shouldAutoScanExactSizes,
  shouldQueueCloudBoundedEstimate,
  shouldQueueExactBackgroundScan,
} from "../../../utils/directorySizePolicy";
import {
  getCloudAttemptKey,
  getExactAttemptKey,
  isStaleSizePath,
  MAX_BACKGROUND_CLOUD_WORKERS,
  MAX_BACKGROUND_DIR_SIZE_WORKERS,
  MAX_BACKGROUND_EXACT_WORKERS,
  type BackgroundSizeScheduler,
} from "./backgroundDirSizeScheduler";

type EstimateStatus = Extract<DirectorySizeStatus, "estimated" | "partial">;

interface SizeUpdateCallbacks {
  setEntrySizeStatus: (
    panel: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  updateEntrySizeEstimate: (
    panel: PanelId,
    path: string,
    size: number,
    status: EstimateStatus
  ) => void;
  updateEntrySize: (panel: PanelId, path: string, size: number) => void;
}

interface QueueCommonArgs extends SizeUpdateCallbacks {
  files: FileEntry[];
  isCurrentScheduler: () => boolean;
  panelId: PanelId;
  scheduler: BackgroundSizeScheduler;
  sizeCacheStale: Record<string, boolean>;
}

interface QueueEstimateArgs extends QueueCommonArgs {
  currentPath: string;
  estimateDirSize: (
    path: string,
    options?: { maxDepth?: number; maxEntries?: number }
  ) => Promise<DirectorySizeEstimate>;
}

interface QueueCloudArgs extends QueueEstimateArgs {
  accessPath?: string;
  attemptedCloudKeys: Set<string>;
}

interface QueueExactArgs extends QueueCommonArgs {
  accessPath?: string;
  currentPath: string;
  attemptedExactKeys: Set<string>;
  nextScanId: () => string;
  scanDirSize: (
    path: string,
    scanId: string
  ) => Promise<DirectorySizeScanResult>;
}

export const queueAutomaticDirSizeEstimates = ({
  currentPath,
  estimateDirSize,
  files,
  isCurrentScheduler,
  panelId,
  scheduler,
  setEntrySizeStatus,
  updateEntrySizeEstimate,
}: QueueEstimateArgs) => {
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

      void estimateDirSize(entry.path, estimateOptions)
        .then((estimate) => {
          if (!isCurrentScheduler()) {
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
          if (!isCurrentScheduler()) {
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

          if (isCurrentScheduler()) {
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
};

export const queueCloudBoundedDirSizeEstimates = ({
  accessPath,
  attemptedCloudKeys,
  currentPath,
  estimateDirSize,
  files,
  isCurrentScheduler,
  panelId,
  scheduler,
  setEntrySizeStatus,
  sizeCacheStale,
  updateEntrySize,
  updateEntrySizeEstimate,
}: QueueCloudArgs) => {
  const contextPaths = accessPath ? [currentPath, accessPath] : [currentPath];
  const isStale = isStaleSizePath(sizeCacheStale);
  const pendingDirectories = files.filter((entry) => {
    const stale = isStale(entry.path);
    const attemptKey = getCloudAttemptKey(entry, stale, contextPaths);
    return (
      shouldQueueCloudBoundedEstimate(entry, stale, contextPaths) &&
      !scheduler.queuedCloudPaths.has(entry.path) &&
      !attemptedCloudKeys.has(attemptKey) &&
      !scheduler.settledCloudPaths.has(entry.path)
    );
  });

  if (pendingDirectories.length === 0) {
    return;
  }

  const drainCloudQueue = () => {
    while (
      scheduler.activeCloudCount < MAX_BACKGROUND_CLOUD_WORKERS &&
      scheduler.cloudQueue.length > 0
    ) {
      const queuedEntry = scheduler.cloudQueue.shift();
      if (!queuedEntry) {
        return;
      }

      scheduler.activeCloudCount += 1;
      setEntrySizeStatus(panelId, queuedEntry.path, "estimating");

      void estimateDirSize(queuedEntry.path, CLOUD_BOUNDED_ESTIMATE_OPTIONS)
        .then((estimate) => {
          if (!isCurrentScheduler()) {
            return;
          }

          scheduler.settledCloudPaths.add(queuedEntry.path);
          if (estimate.isPartial) {
            updateEntrySizeEstimate(
              panelId,
              queuedEntry.path,
              estimate.size,
              "partial"
            );
          } else {
            updateEntrySize(panelId, queuedEntry.path, estimate.size);
          }
        })
        .catch((error) => {
          if (!isCurrentScheduler()) {
            return;
          }

          scheduler.settledCloudPaths.add(queuedEntry.path);
          setEntrySizeStatus(panelId, queuedEntry.path, "error");
          console.error(
            `Failed to estimate bounded cloud dir size for ${queuedEntry.path}:`,
            error
          );
        })
        .finally(() => {
          scheduler.queuedCloudPaths.delete(queuedEntry.path);
          scheduler.activeCloudCount -= 1;

          if (isCurrentScheduler()) {
            drainCloudQueue();
          }
        });
    }
  };

  for (const entry of pendingDirectories) {
    const stale = isStale(entry.path);
    const attemptKey = getCloudAttemptKey(entry, stale, contextPaths);
    scheduler.cloudQueue.push({ attemptKey, path: entry.path });
    scheduler.queuedCloudPaths.add(entry.path);
    attemptedCloudKeys.add(attemptKey);
  }

  drainCloudQueue();
};

export const queueExactDirSizeScans = ({
  accessPath,
  attemptedExactKeys,
  currentPath,
  files,
  isCurrentScheduler,
  nextScanId,
  panelId,
  scanDirSize,
  scheduler,
  setEntrySizeStatus,
  sizeCacheStale,
  updateEntrySize,
  updateEntrySizeEstimate,
}: QueueExactArgs) => {
  if (!shouldAutoScanExactSizes(accessPath ?? currentPath)) {
    return;
  }

  const isStale = isStaleSizePath(sizeCacheStale);
  const pendingDirectories = files.filter((entry) => {
    const stale = isStale(entry.path);
    const attemptKey = getExactAttemptKey(entry, stale);
    return (
      shouldQueueExactBackgroundScan(entry, stale) &&
      !scheduler.queuedExactPaths.has(entry.path) &&
      !attemptedExactKeys.has(attemptKey) &&
      !scheduler.settledExactPaths.has(entry.path)
    );
  });

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
      const scanId = nextScanId();
      scheduler.activeExactScans.set(scanId, queuedEntry.path);
      setEntrySizeStatus(panelId, queuedEntry.path, "calculating");

      void scanDirSize(queuedEntry.path, scanId)
        .then((result) => {
          if (!isCurrentScheduler()) {
            return;
          }

          scheduler.settledExactPaths.add(queuedEntry.path);
          if (result.isPartial) {
            updateEntrySizeEstimate(
              panelId,
              queuedEntry.path,
              result.size,
              "partial"
            );
          } else {
            updateEntrySize(panelId, queuedEntry.path, result.size);
          }
        })
        .catch((error) => {
          if (!isCurrentScheduler()) {
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

          if (isCurrentScheduler()) {
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
    attemptedExactKeys.add(attemptKey);
  }

  drainExactQueue();
};
