import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useFileSystem } from "../../../hooks/useFileSystem";
import type { DirectorySizeProgressEvent } from "../../../hooks/tauriCommands/fileCommands";
import type { DirectorySizeStatus, FileEntry, PanelId } from "../../../types/file";
import {
  createScheduler,
  type BackgroundSizeScheduler,
} from "./backgroundDirSizeScheduler";
import {
  queueAutomaticDirSizeEstimates,
  queueCloudBoundedDirSizeEstimates,
  queueExactDirSizeScans,
} from "./backgroundDirSizeQueueRunners";

export {
  getAutomaticEstimateOptions,
  isLikelyCloudStoragePath,
  isLikelyVolatileAutoScanPath,
  shouldAutoScanExactSizes,
  shouldQueueExactBackgroundScan,
} from "../../../utils/directorySizePolicy";

interface UseBackgroundDirSizesProps {
  accessPath?: string;
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

export const useBackgroundDirSizes = ({
  accessPath,
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
  const attemptedCloudKeysRef = useRef(new Set<string>());
  const backgroundSchedulerRef = useRef<BackgroundSizeScheduler>(
    createScheduler()
  );

  useEffect(() => {
    attemptedExactKeysRef.current = new Set();
    attemptedCloudKeysRef.current = new Set();
  }, [accessPath, activeTabId, currentPath, panelId]);

  useEffect(() => {
    const previousScheduler = backgroundSchedulerRef.current;
    for (const scanId of previousScheduler.activeExactScans.keys()) {
      void fs.cancelDirSizeScan(scanId);
    }

    backgroundSchedulerRef.current = createScheduler();
  }, [accessPath, activeTabId, currentPath, lastUpdated, panelId]);

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
    queueAutomaticDirSizeEstimates({
      currentPath,
      estimateDirSize: fs.estimateDirSize,
      files,
      isCurrentScheduler: () => backgroundSchedulerRef.current === scheduler,
      panelId,
      scheduler,
      setEntrySizeStatus,
      sizeCacheStale,
      updateEntrySize,
      updateEntrySizeEstimate,
    });
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
    const scheduler = backgroundSchedulerRef.current;
    queueCloudBoundedDirSizeEstimates({
      accessPath,
      attemptedCloudKeys: attemptedCloudKeysRef.current,
      currentPath,
      estimateDirSize: fs.estimateDirSize,
      files,
      isCurrentScheduler: () => backgroundSchedulerRef.current === scheduler,
      panelId,
      scheduler,
      setEntrySizeStatus,
      sizeCacheStale,
      updateEntrySize,
      updateEntrySizeEstimate,
    });
  }, [
    accessPath,
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

  useEffect(() => {
    const scheduler = backgroundSchedulerRef.current;
    queueExactDirSizeScans({
      accessPath,
      attemptedExactKeys: attemptedExactKeysRef.current,
      currentPath,
      files,
      isCurrentScheduler: () => backgroundSchedulerRef.current === scheduler,
      nextScanId: () => `${panelId}-${Date.now()}-${scanCounterRef.current++}`,
      panelId,
      scanDirSize: fs.scanDirSize,
      scheduler,
      setEntrySizeStatus,
      sizeCacheStale,
      updateEntrySize,
      updateEntrySizeEstimate,
    });
  }, [
    accessPath,
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
