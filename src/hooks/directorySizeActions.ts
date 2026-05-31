import {
  calculatePanelDirectories,
  type DirectorySizeCalculationResult,
} from "./calculatePanelDirectories";
import {
  cancelManualDirectorySizeScan,
  scanDirectorySizeWithProgress,
} from "./manualDirectorySizeScan";
import type { DirectorySizeScanResult } from "./tauriCommands/fileCommands";
import { showTransientToast } from "../store/toastStore";
import type { DirectorySizeStatus, PanelId, PanelState } from "../types/file";
import { formatSize } from "../utils/format";

interface DirectorySizeClient {
  cancelDirSizeScan: (scanId: string) => Promise<void>;
  scanDirSize: (path: string, scanId: string) => Promise<DirectorySizeScanResult>;
}

interface DirectorySizeUpdaters {
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
    status: Extract<DirectorySizeStatus, "estimated" | "partial">
  ) => void;
  updateEntrySizeProgress: (panelId: PanelId, path: string, size: number) => void;
}

interface CalculatePanelDirectorySizesArgs extends DirectorySizeUpdaters {
  client: DirectorySizeClient;
  panelId: PanelId;
  panel: PanelState;
}

interface CalculateDirectorySizesForPanelsArgs extends DirectorySizeUpdaters {
  client: DirectorySizeClient;
  panels: Array<{
    panelId: PanelId;
    panel: PanelState;
  }>;
}

interface CalculateDirectoryEntrySizeArgs extends DirectorySizeUpdaters {
  client: DirectorySizeClient;
  panelId: PanelId;
  path: string;
  name: string;
}

export const getDirectorySizeCompletionMessage = (
  result: DirectorySizeCalculationResult
) =>
  result.failed > 0
    ? `폴더 용량 계산 완료: ${result.completed}/${result.total}개`
    : `폴더 용량 계산 완료: ${result.completed}개`;

export const calculatePanelDirectorySizesWithToast = async ({
  client,
  panelId,
  panel,
  setEntrySizeStatus,
  updateEntrySize,
  updateEntrySizeEstimate,
  updateEntrySizeProgress,
}: CalculatePanelDirectorySizesArgs) => {
  showTransientToast("폴더 용량 계산을 시작했습니다.");
  const result = await calculatePanelDirectories({
    cancelDirSizeScan: client.cancelDirSizeScan,
    panelId,
    panel,
    scanDirSize: client.scanDirSize,
    setEntrySizeStatus,
    updateEntrySize,
    updateEntrySizeEstimate,
    updateEntrySizeProgress,
  });
  showTransientToast(getDirectorySizeCompletionMessage(result));
  return result;
};

export const calculateDirectorySizesForPanels = ({
  client,
  panels,
  setEntrySizeStatus,
  updateEntrySize,
  updateEntrySizeEstimate,
  updateEntrySizeProgress,
}: CalculateDirectorySizesForPanelsArgs) =>
  Promise.all(
    panels.map(({ panelId, panel }) =>
      calculatePanelDirectories({
        cancelDirSizeScan: client.cancelDirSizeScan,
        panelId,
        panel,
        scanDirSize: client.scanDirSize,
        setEntrySizeStatus,
        updateEntrySize,
        updateEntrySizeEstimate,
        updateEntrySizeProgress,
      })
    )
  );

export const calculateDirectoryEntrySizeWithToast = async ({
  client,
  panelId,
  path,
  name,
  setEntrySizeStatus,
  updateEntrySize,
  updateEntrySizeEstimate,
  updateEntrySizeProgress,
}: CalculateDirectoryEntrySizeArgs) => {
  if (await cancelManualDirectorySizeScan(path)) {
    showTransientToast("폴더 용량 계산을 취소했습니다.", { tone: "warning" });
    return { status: "cancelled" as const };
  }

  showTransientToast("폴더 용량 계산을 시작했습니다.");
  try {
    const result = await scanDirectorySizeWithProgress({
      cancelDirSizeScan: client.cancelDirSizeScan,
      panelId,
      path,
      scanDirSize: client.scanDirSize,
      setEntrySizeStatus,
      updateEntrySize,
      updateEntrySizeEstimate,
      updateEntrySizeProgress,
    });

    if (result.status === "cancelled") {
      showTransientToast("폴더 용량 계산을 취소했습니다.", { tone: "warning" });
    } else if (typeof result.size === "number") {
      const suffix = result.isPartial ? "+" : "";
      showTransientToast(`${name}: ${formatSize(result.size)}${suffix}`);
    }

    return result;
  } catch (error) {
    setEntrySizeStatus(panelId, path, "error");
    throw error;
  }
};
