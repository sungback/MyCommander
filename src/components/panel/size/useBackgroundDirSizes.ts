import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useFileSystem } from "../../../hooks/useFileSystem";
import type { DirectorySizeProgressEvent } from "../../../hooks/tauriCommands/fileCommands";
import type { DirectorySizeStatus, FileEntry, PanelId } from "../../../types/file";
import {
  MAX_BACKGROUND_DIR_SIZE_WORKERS,
  MAX_BACKGROUND_EXACT_WORKERS,
  createScheduler,
  getAutomaticEstimateOptions,
  getExactAttemptKey,
  shouldAutoScanExactSizes,
  shouldQueueExactBackgroundScan,
  type BackgroundSizeScheduler,
} from "./backgroundDirSizeHelpers";

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

// 파일 변경으로 stale이 된 폴더를 다시 정확 계산하기까지 두는 최소 간격
const EXACT_RESCAN_COOLDOWN_MS = 30_000;

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
  const lastExactFinishedAtRef = useRef(new Map<string, number>());
  const [rescanTick, setRescanTick] = useState(0);
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
    // lastUpdated(파일 변경 감시)로는 진행 중인 스캔을 취소하지 않는다. 경로·탭이 바뀔 때만 초기화한다.
  }, [activeTabId, currentPath, panelId]);

  useEffect(() => {
    // 패널이 새로고침되면 완료/실패로 기록된 항목을 다시 시도할 수 있게 한다. 진행 중인 스캔은 유지한다.
    const scheduler = backgroundSchedulerRef.current;
    scheduler.settledPaths.clear();
    scheduler.settledExactPaths.clear();
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
              "estimated"
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
    const now = Date.now();
    let nextRetryDelay: number | null = null;
    const pendingDirectories = files.filter(
      (entry) => {
        const stale = isStale(entry.path);
        const attemptKey = getExactAttemptKey(entry, stale);
        const shouldQueue =
          shouldQueueExactBackgroundScan(entry, stale) &&
          !scheduler.queuedExactPaths.has(entry.path) &&
          !attemptedExactKeysRef.current.has(attemptKey) &&
          !scheduler.settledExactPaths.has(entry.path);
        if (!shouldQueue) {
          return false;
        }

        const finishedAt = lastExactFinishedAtRef.current.get(entry.path);
        if (stale && finishedAt !== undefined) {
          const remaining = finishedAt + EXACT_RESCAN_COOLDOWN_MS - now;
          if (remaining > 0) {
            nextRetryDelay =
              nextRetryDelay === null ? remaining : Math.min(nextRetryDelay, remaining);
            return false;
          }
        }

        return true;
      }
    );

    const retryTimer =
      nextRetryDelay === null
        ? undefined
        : window.setTimeout(() => setRescanTick((tick) => tick + 1), nextRetryDelay);
    const cancelRetryTimer = () => {
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
      }
    };

    if (pendingDirectories.length === 0) {
      return cancelRetryTimer;
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

            lastExactFinishedAtRef.current.set(queuedEntry.path, Date.now());
            if (result.isPartial) {
              scheduler.settledExactPaths.add(queuedEntry.path);
              updateEntrySizeEstimate(panelId, queuedEntry.path, result.size, "partial");
            } else {
              updateEntrySize(panelId, queuedEntry.path, result.size);
              // 이후 파일 변경으로 다시 stale이 되면 재스캔할 수 있도록 시도 기록을 비운다.
              attemptedExactKeysRef.current.delete(queuedEntry.attemptKey);
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

    return cancelRetryTimer;
  }, [
    currentPath,
    files,
    fs,
    lastUpdated,
    panelId,
    rescanTick,
    sizeCacheStale,
    setEntrySizeStatus,
    updateEntrySize,
    updateEntrySizeEstimate,
  ]);
};
