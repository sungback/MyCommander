import { useEffect, useRef } from "react";
import { useFileSystem } from "../../hooks/useFileSystem";
import type { FileEntry, PanelId } from "../../types/file";

const MAX_BACKGROUND_DIR_SIZE_WORKERS = 2;

interface BackgroundSizeScheduler {
  activeCount: number;
  queue: Array<{ path: string }>;
  queuedPaths: Set<string>;
}

interface UseBackgroundDirSizesProps {
  activeTabId: string;
  currentPath: string;
  files: FileEntry[];
  panelId: PanelId;
  updateEntrySize: (panel: PanelId, path: string, size: number) => void;
}

const createScheduler = (): BackgroundSizeScheduler => ({
  activeCount: 0,
  queue: [],
  queuedPaths: new Set(),
});

export const useBackgroundDirSizes = ({
  activeTabId,
  currentPath,
  files,
  panelId,
  updateEntrySize,
}: UseBackgroundDirSizesProps) => {
  const fs = useFileSystem();
  const backgroundSchedulerRef = useRef<BackgroundSizeScheduler>(
    createScheduler()
  );

  useEffect(() => {
    backgroundSchedulerRef.current = createScheduler();
  }, [activeTabId, currentPath, panelId]);

  useEffect(() => {
    const scheduler = backgroundSchedulerRef.current;
    const pendingDirectories = files.filter(
      (entry) =>
        entry.kind === "directory" &&
        entry.name !== ".." &&
        (entry.size === undefined || entry.size === null) &&
        !scheduler.queuedPaths.has(entry.path)
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

        void fs
          .getDirSize(entry.path)
          .then((size) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            updateEntrySize(panelId, entry.path, size);
          })
          .catch((error) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            console.error(
              `Failed to calculate background dir size for ${entry.path}:`,
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
  }, [currentPath, files, fs, panelId, updateEntrySize]);
};
