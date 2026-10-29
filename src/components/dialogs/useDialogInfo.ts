import { useEffect, useState } from "react";
import { useFileSystem } from "../../hooks/useFileSystem";
import type { UpdateEntrySizeHandler } from "../../hooks/manualDirectorySizeScan";
import { DialogTarget, DialogType } from "../../store/dialogStore";
import { recordScannedChildSizes } from "../../store/scannedChildSizes";
import { DirectorySizeStatus, FileEntry, PanelId } from "../../types/file";

interface UseDialogInfoArgs {
  openDialog: DialogType;
  dialogTarget: DialogTarget | null;
  infoEntry: FileEntry | null;
  updateEntrySize: UpdateEntrySizeHandler;
  updateEntrySizeEstimate: (
    panelId: PanelId,
    path: string,
    size: number,
    status: Extract<DirectorySizeStatus, "estimated" | "partial">
  ) => void;
  fs: ReturnType<typeof useFileSystem>;
}

let infoScanSequence = 0;

export const useDialogInfo = ({
  openDialog,
  dialogTarget,
  infoEntry,
  updateEntrySize,
  updateEntrySizeEstimate,
  fs,
}: UseDialogInfoArgs) => {
  const [infoSize, setInfoSize] = useState<number | null>(null);
  const [infoSizeStatus, setInfoSizeStatus] = useState<DirectorySizeStatus | undefined>(
    undefined
  );
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  useEffect(() => {
    if (openDialog !== "info" || !dialogTarget || !infoEntry) {
      setInfoSize(null);
      setInfoSizeStatus(undefined);
      setInfoLoading(false);
      setInfoError(null);
      return;
    }

    if (infoEntry.kind !== "directory") {
      setInfoSize(infoEntry.size ?? null);
      setInfoSizeStatus(undefined);
      setInfoLoading(false);
      setInfoError(null);
      return;
    }

    if (infoEntry.size !== undefined && infoEntry.size !== null) {
      setInfoSize(infoEntry.size);
      setInfoSizeStatus(infoEntry.sizeStatus);
      setInfoLoading(false);
      setInfoError(null);
      return;
    }

    let cancelled = false;
    let finished = false;
    const scanId = `info-dir-size-${dialogTarget.panelId}-${Date.now()}-${infoScanSequence++}`;
    setInfoSize(null);
    setInfoSizeStatus(undefined);
    setInfoLoading(true);
    setInfoError(null);

    // 패널의 정확 계산과 같은 경로로 계산해 접근 불가(limited)·부분 결과를 그대로 반영한다.
    fs.scanDirSize(infoEntry.path, scanId)
      .then((result) => {
        finished = true;
        // 다이얼로그를 닫았어도 끝난 계산의 하위 폴더 결과는 유효하다.
        recordScannedChildSizes(result);
        if (cancelled) return;
        setInfoSize(result.size);
        if (result.isPartial) {
          setInfoSizeStatus("partial");
          updateEntrySizeEstimate(dialogTarget.panelId, infoEntry.path, result.size, "partial");
          return;
        }

        const status = result.inaccessibleCount > 0 ? "limited" : "exact";
        setInfoSizeStatus(status);
        updateEntrySize(dialogTarget.panelId, infoEntry.path, result.size, undefined, status);
      })
      .catch((error) => {
        finished = true;
        if (cancelled) return;
        console.error("Failed to calculate dir size:", error);
        setInfoError("Failed to calculate folder size.");
      })
      .finally(() => {
        if (!cancelled) {
          setInfoLoading(false);
        }
      });

    return () => {
      cancelled = true;
      // 다이얼로그를 닫거나 대상이 바뀌면 끝나지 않은 계산의 대기를 취소한다.
      if (!finished) {
        void fs.cancelDirSizeScan(scanId).catch(() => undefined);
      }
    };
  }, [dialogTarget, fs, infoEntry, openDialog, updateEntrySize, updateEntrySizeEstimate]);

  return {
    infoSize,
    infoSizeStatus,
    infoLoading,
    infoError,
  };
};
