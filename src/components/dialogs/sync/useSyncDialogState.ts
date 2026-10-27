import { useEffect, useState } from "react";
import { getErrorMessage, useFileSystem } from "../../../hooks/useFileSystem";
import type { PanelId, PanelState } from "../../../types/file";
import type { SyncDirection, SyncItem } from "../../../types/sync";
import { buildSyncExecutionOperations } from "../../../features/syncExecution";
import { confirmTransferSpace } from "../../../features/transferSpaceCheck";
import {
  excludeSameSyncItems,
  formatSyncExecutionFailures,
  getPanelAccessPath,
  selectAllPendingSyncItems,
  type SyncExecutionFailure,
  type SyncStage,
  updateSyncItemDirection,
} from "./syncDialogHelpers";

interface UseSyncDialogStateArgs {
  openDialog: string | null;
  leftPanel: PanelState;
  rightPanel: PanelState;
  showHiddenFiles: boolean;
  fs: ReturnType<typeof useFileSystem>;
  refreshPanel: (panel: PanelId) => void;
  closeDialog: () => void;
}

export const useSyncDialogState = ({
  openDialog,
  leftPanel,
  rightPanel,
  showHiddenFiles,
  fs,
  refreshPanel,
  closeDialog,
}: UseSyncDialogStateArgs) => {
  const [stage, setStage] = useState<SyncStage>("paths");
  const [leftPath, setLeftPath] = useState(getPanelAccessPath(leftPanel));
  const [rightPath, setRightPath] = useState(getPanelAccessPath(rightPanel));
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState({
    done: 0,
    total: 0,
  });

  useEffect(() => {
    if (openDialog === "sync") {
      setLeftPath(getPanelAccessPath(leftPanel));
      setRightPath(getPanelAccessPath(rightPanel));
      setStage("paths");
      setError(null);
      setSyncItems([]);
      setExecuting(false);
    }
  }, [
    leftPanel.currentPath,
    leftPanel.resolvedPath,
    openDialog,
    rightPanel.currentPath,
    rightPanel.resolvedPath,
  ]);

  const handleStartAnalysis = async () => {
    if (!leftPath || !rightPath) {
      setError("Both paths must be specified.");
      return;
    }

    setStage("analyzing");
    setError(null);

    try {
      const items = await fs.compareDirectories(
        leftPath,
        rightPath,
        showHiddenFiles
      );
      setSyncItems(items);
      setStage("results");
    } catch (error) {
      console.error(error);
      setError(getErrorMessage(error, "Failed to analyze directories."));
      setStage("paths");
    }
  };

  const handleUpdateDirection = (
    index: number,
    newDirection: SyncDirection
  ) => {
    setSyncItems((current) =>
      updateSyncItemDirection(current, index, newDirection)
    );
  };

  const handleSelectAll = (
    targetDirection: Exclude<SyncDirection, "skip">
  ) => {
    setSyncItems((current) =>
      selectAllPendingSyncItems(current, targetDirection)
    );
  };

  const handleExcludeSame = () => {
    setSyncItems((current) => excludeSameSyncItems(current));
  };

  const handleExecuteSync = async () => {
    const itemsToSync = syncItems.filter((item) => item.direction !== "skip");
    if (itemsToSync.length === 0) {
      setError("No items to synchronize.");
      return;
    }

    const operations = buildSyncExecutionOperations(syncItems, leftPath, rightPath);
    if (operations.length === 0) {
      setError("No actionable items to synchronize.");
      return;
    }

    // 방향별로 대상 볼륨이 다르므로 방향마다 한 번씩 공간을 확인한다.
    const directionTargets = [
      ["toRight", rightPath],
      ["toLeft", leftPath],
    ] as const;
    for (const [direction, targetRoot] of directionTargets) {
      const sourcePaths = operations
        .filter((operation) => operation.direction === direction)
        .map((operation) => operation.sourcePath);
      if (!(await confirmTransferSpace(fs, sourcePaths, targetRoot, false))) {
        return;
      }
    }

    setStage("executing");
    setExecuting(true);
    setError(null);
    setExecutionProgress({ done: 0, total: operations.length });

    try {
      let completed = 0;
      const failures: SyncExecutionFailure[] = [];

      for (const operation of operations) {
        try {
          await fs.copyFiles([operation.sourcePath], operation.targetPath, false, true);
        } catch (itemError) {
          console.error(`Failed to sync ${operation.relPath}:`, itemError);
          failures.push({
            relPath: operation.relPath,
            message: getErrorMessage(itemError, "Unknown error"),
          });
        }
        completed++;
        setExecutionProgress({ done: completed, total: operations.length });
      }

      refreshPanel("left");
      refreshPanel("right");

      if (failures.length > 0) {
        setError(formatSyncExecutionFailures(failures));
        setStage("results");
        return;
      }

      closeDialog();
    } catch (error) {
      console.error(error);
      setError(getErrorMessage(error, "Sync operation failed."));
      setStage("results");
    } finally {
      setExecuting(false);
    }
  };

  const handleBack = () => {
    if (stage === "results") {
      setStage("paths");
      setError(null);
    }
  };

  return {
    stage,
    leftPath,
    setLeftPath,
    rightPath,
    setRightPath,
    syncItems,
    error,
    executing,
    executionProgress,
    handleStartAnalysis,
    handleUpdateDirection,
    handleSelectAll,
    handleExcludeSame,
    handleExecuteSync,
    handleBack,
  };
};
