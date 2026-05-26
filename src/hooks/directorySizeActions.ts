import type { DirectorySizeStatus, PanelId, PanelState } from "../types/file";
import { formatSize } from "../utils/format";
import {
  calculatePanelDirectories,
  type DirectorySizeCalculationResult,
} from "./calculatePanelDirectories";
import {
  cancelManualDirectorySizeScan,
  scanDirectorySizeWithProgress,
  type ManualDirectorySizeScanOutcome,
} from "./manualDirectorySizeScan";
import type { DirectorySizeScanResult } from "./tauriCommands/fileCommands";

type EstimatedSizeStatus = Extract<
  DirectorySizeStatus,
  "estimated" | "partial"
>;

export interface DirectorySizeActionCallbacks {
  cancelDirSizeScan: (scanId: string) => Promise<void>;
  scanDirSize: (
    path: string,
    scanId: string
  ) => Promise<DirectorySizeScanResult>;
  setEntrySizeStatus: (
    panelId: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  updateEntrySize: (panelId: PanelId, path: string, size: number) => void;
  updateEntrySizeEstimate: (
    panelId: PanelId,
    path: string,
    size: number,
    status: EstimatedSizeStatus
  ) => void;
  updateEntrySizeProgress: (
    panelId: PanelId,
    path: string,
    size: number
  ) => void;
}

export interface ToggleDirectorySizeScanArgs
  extends DirectorySizeActionCallbacks {
  panelId: PanelId;
  path: string;
}

export const toggleDirectorySizeScan = async ({
  cancelDirSizeScan,
  panelId,
  path,
  scanDirSize,
  setEntrySizeStatus,
  updateEntrySize,
  updateEntrySizeEstimate,
  updateEntrySizeProgress,
}: ToggleDirectorySizeScanArgs): Promise<ManualDirectorySizeScanOutcome> => {
  if (await cancelManualDirectorySizeScan(path)) {
    return { status: "cancelled" };
  }

  try {
    return await scanDirectorySizeWithProgress({
      cancelDirSizeScan,
      panelId,
      path,
      scanDirSize,
      setEntrySizeStatus,
      updateEntrySize,
      updateEntrySizeEstimate,
      updateEntrySizeProgress,
    });
  } catch (error) {
    setEntrySizeStatus(panelId, path, "error");
    throw error;
  }
};

export interface CalculatePanelDirectorySizesArgs
  extends DirectorySizeActionCallbacks {
  panelId: PanelId;
  panel: PanelState;
}

export const calculatePanelDirectorySizes = ({
  cancelDirSizeScan,
  panelId,
  panel,
  scanDirSize,
  setEntrySizeStatus,
  updateEntrySize,
  updateEntrySizeEstimate,
  updateEntrySizeProgress,
}: CalculatePanelDirectorySizesArgs): Promise<DirectorySizeCalculationResult> =>
  calculatePanelDirectories({
    cancelDirSizeScan,
    panelId,
    panel,
    scanDirSize,
    setEntrySizeStatus,
    updateEntrySize,
    updateEntrySizeEstimate,
    updateEntrySizeProgress,
  });

export const getPanelDirectorySizeCompletionMessage = (
  result: DirectorySizeCalculationResult
) =>
  result.failed > 0
    ? `폴더 용량 계산 완료: ${result.completed}/${result.total}개`
    : `폴더 용량 계산 완료: ${result.completed}개`;

export const getSingleDirectorySizeCompletionMessage = (
  name: string,
  outcome: ManualDirectorySizeScanOutcome
) => {
  if (outcome.status === "cancelled") {
    return null;
  }

  if (typeof outcome.size !== "number") {
    return null;
  }

  const suffix = outcome.isPartial ? "+" : "";
  return `${name}: ${formatSize(outcome.size)}${suffix}`;
};
