import { listen } from "@tauri-apps/api/event";
import type {
  DirectorySizeProgressEvent,
  DirectorySizeScanResult,
} from "./tauriCommands/fileCommands";
import type {
  ConfirmedDirectorySizeStatus,
  DirectorySizeStatus,
  PanelId,
} from "../types/file";

type PersistentEstimateStatus = Extract<DirectorySizeStatus, "estimated" | "partial">;

// 정확 계산 결과를 패널에 반영한다. status를 생략하면 exact로 저장한다.
export type UpdateEntrySizeHandler = (
  panelId: PanelId,
  path: string,
  size: number,
  scanStartedAt?: number,
  status?: ConfirmedDirectorySizeStatus
) => void;

interface ManualDirectorySizeScanCallbacks {
  setEntrySizeStatus: (
    panelId: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  updateEntrySize: UpdateEntrySizeHandler;
  updateEntrySizeEstimate: (
    panelId: PanelId,
    path: string,
    size: number,
    status: PersistentEstimateStatus
  ) => void;
  updateEntrySizeProgress: (panelId: PanelId, path: string, size: number) => void;
}

export interface ManualDirectorySizeScanArgs
  extends ManualDirectorySizeScanCallbacks {
  cancelDirSizeScan: (scanId: string) => Promise<void>;
  panelId: PanelId;
  path: string;
  scanDirSize: (path: string, scanId: string) => Promise<DirectorySizeScanResult>;
}

export interface ManualDirectorySizeScanOutcome {
  status: "completed" | "cancelled";
  size?: number;
  isPartial?: boolean;
  // 권한이 없어 읽지 못한 항목이 있어 size가 하한값이면 true
  isLimited?: boolean;
}

interface ActiveManualDirectorySizeScan extends ManualDirectorySizeScanCallbacks {
  cancelDirSizeScan: (scanId: string) => Promise<void>;
  cancelRequested: boolean;
  lastSize: number | null;
  panelId: PanelId;
  path: string;
  scanId: string;
}

const activeScansById = new Map<string, ActiveManualDirectorySizeScan>();
const activeScanIdsByPath = new Map<string, string>();
let progressListenerReady: Promise<void> | null = null;
let progressUnlisten: (() => void) | null = null;
let scanSequence = 0;

const normalizePathKey = (path: string) => path.normalize("NFC");

const isCancellationError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return message.toLowerCase().includes("cancel");
};

const ensureProgressListener = () => {
  if (!progressListenerReady) {
    progressListenerReady = listen<DirectorySizeProgressEvent>(
      "dir-size-progress",
      (event) => {
        const active = activeScansById.get(event.payload.scanId);
        if (!active || event.payload.completed || event.payload.path !== active.path) {
          return;
        }

        active.lastSize = event.payload.size;
        active.updateEntrySizeProgress(
          active.panelId,
          active.path,
          event.payload.size
        );
      }
    )
      .then((unlisten) => {
        progressUnlisten = unlisten;
      })
      .catch((error) => {
        console.error("Failed to listen for manual directory size progress:", error);
      });
  }

  return progressListenerReady;
};

export const __resetManualDirectorySizeScansForTests = () => {
  activeScansById.clear();
  activeScanIdsByPath.clear();
  progressUnlisten?.();
  progressUnlisten = null;
  progressListenerReady = null;
  scanSequence = 0;
};

const finishCancelledScan = (active: ActiveManualDirectorySizeScan) => {
  if (active.lastSize !== null) {
    active.updateEntrySizeEstimate(
      active.panelId,
      active.path,
      active.lastSize,
      "partial"
    );
  } else {
    active.setEntrySizeStatus(active.panelId, active.path, "unknown");
  }
};

export const isManualDirectorySizeScanActive = (path: string) => {
  const scanId = activeScanIdsByPath.get(normalizePathKey(path));
  return Boolean(scanId && activeScansById.has(scanId));
};

export const cancelManualDirectorySizeScan = async (path: string) => {
  const scanId = activeScanIdsByPath.get(normalizePathKey(path));
  if (!scanId) {
    return false;
  }

  const active = activeScansById.get(scanId);
  if (!active) {
    activeScanIdsByPath.delete(normalizePathKey(path));
    return false;
  }

  active.cancelRequested = true;
  finishCancelledScan(active);
  await active.cancelDirSizeScan(scanId);
  return true;
};

export const scanDirectorySizeWithProgress = async ({
  cancelDirSizeScan,
  panelId,
  path,
  scanDirSize,
  setEntrySizeStatus,
  updateEntrySize,
  updateEntrySizeEstimate,
  updateEntrySizeProgress,
}: ManualDirectorySizeScanArgs): Promise<ManualDirectorySizeScanOutcome> => {
  const pathKey = normalizePathKey(path);
  const existingScanId = activeScanIdsByPath.get(pathKey);
  if (existingScanId && activeScansById.has(existingScanId)) {
    return { status: "completed" };
  }

  await ensureProgressListener();

  const scanId = `manual-dir-size-${panelId}-${Date.now()}-${scanSequence++}`;
  const active: ActiveManualDirectorySizeScan = {
    cancelDirSizeScan,
    cancelRequested: false,
    lastSize: null,
    panelId,
    path,
    scanId,
    setEntrySizeStatus,
    updateEntrySize,
    updateEntrySizeEstimate,
    updateEntrySizeProgress,
  };

  activeScansById.set(scanId, active);
  activeScanIdsByPath.set(pathKey, scanId);
  setEntrySizeStatus(panelId, path, "calculating");

  try {
    const result = await scanDirSize(path, scanId);

    const isLimited = !result.isPartial && result.inaccessibleCount > 0;
    if (result.isPartial) {
      updateEntrySizeEstimate(panelId, path, result.size, "partial");
    } else {
      updateEntrySize(
        panelId,
        path,
        result.size,
        undefined,
        isLimited ? "limited" : "exact"
      );
    }

    return {
      status: "completed",
      size: result.size,
      isPartial: result.isPartial,
      isLimited,
    };
  } catch (error) {
    if (active.cancelRequested || isCancellationError(error)) {
      finishCancelledScan(active);
      return {
        status: "cancelled",
        size: active.lastSize ?? undefined,
        isPartial: active.lastSize !== null,
      };
    }

    setEntrySizeStatus(panelId, path, "error");
    throw error;
  } finally {
    activeScansById.delete(scanId);
    if (activeScanIdsByPath.get(pathKey) === scanId) {
      activeScanIdsByPath.delete(pathKey);
    }
  }
};
