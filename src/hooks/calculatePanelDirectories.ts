import type { PanelId, PanelState, DirectorySizeStatus } from "../types/file";
import {
  scanDirectorySizeWithProgress,
  type ManualDirectorySizeScanOutcome,
} from "./manualDirectorySizeScan";
import type { DirectorySizeScanResult } from "./tauriCommands/fileCommands";

interface CalculatePanelDirectoriesArgs {
  cancelDirSizeScan: (scanId: string) => Promise<void>;
  panelId: PanelId;
  panel: PanelState;
  scanDirSize: (path: string, scanId: string) => Promise<DirectorySizeScanResult>;
  setEntrySizeStatus?: (
    panelId: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  updateEntrySize: (panelId: PanelId, path: string, size: number) => void;
  updateEntrySizeEstimate?: (
    panelId: PanelId,
    path: string,
    size: number,
    status: Extract<DirectorySizeStatus, "estimated" | "partial">
  ) => void;
  updateEntrySizeProgress?: (panelId: PanelId, path: string, size: number) => void;
}

export interface DirectorySizeCalculationResult {
  total: number;
  completed: number;
  failed: number;
}

export const calculatePanelDirectories = async ({
  cancelDirSizeScan,
  panelId,
  panel,
  scanDirSize,
  setEntrySizeStatus,
  updateEntrySize,
  updateEntrySizeEstimate,
  updateEntrySizeProgress,
}: CalculatePanelDirectoriesArgs): Promise<DirectorySizeCalculationResult> => {
  const directories = panel.files.filter(
    (entry) => entry.kind === "directory" && entry.name !== ".."
  );
  const result: DirectorySizeCalculationResult = {
    total: directories.length,
    completed: 0,
    failed: 0,
  };
  const queue = [...directories];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) {
        return;
      }

      try {
        const outcome: ManualDirectorySizeScanOutcome =
          await scanDirectorySizeWithProgress({
            cancelDirSizeScan,
            panelId,
            path: entry.path,
            scanDirSize,
            setEntrySizeStatus:
              setEntrySizeStatus ?? (() => undefined),
            updateEntrySize,
            updateEntrySizeEstimate:
              updateEntrySizeEstimate ??
              ((nextPanelId, path, size) =>
                updateEntrySize(nextPanelId, path, size)),
            updateEntrySizeProgress:
              updateEntrySizeProgress ??
              ((nextPanelId, path, size) =>
                updateEntrySize(nextPanelId, path, size)),
          });

        if (outcome.status === "completed") {
          result.completed += 1;
        }
      } catch (error) {
        setEntrySizeStatus?.(panelId, entry.path, "error");
        result.failed += 1;
        console.error(`Failed to calculate dir size for ${entry.path}:`, error);
      }
    }
  });

  await Promise.all(workers);
  return result;
};
