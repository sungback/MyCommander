import { useEffect, useState } from "react";
import { useFileSystem } from "../../hooks/useFileSystem";
import { DialogTarget, DialogType } from "../../store/dialogStore";
import { FileEntry, PanelId } from "../../types/file";

interface UseDialogInfoArgs {
  openDialog: DialogType;
  dialogTarget: DialogTarget | null;
  infoEntry: FileEntry | null;
  updateEntrySize: (panelId: PanelId, path: string, size: number) => void;
  fs: ReturnType<typeof useFileSystem>;
}

export const useDialogInfo = ({
  openDialog,
  dialogTarget,
  infoEntry,
  updateEntrySize,
  fs,
}: UseDialogInfoArgs) => {
  const [infoSize, setInfoSize] = useState<number | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  useEffect(() => {
    if (openDialog !== "info" || !dialogTarget || !infoEntry) {
      setInfoSize(null);
      setInfoLoading(false);
      setInfoError(null);
      return;
    }

    if (infoEntry.kind !== "directory") {
      setInfoSize(infoEntry.size ?? null);
      setInfoLoading(false);
      setInfoError(null);
      return;
    }

    if (infoEntry.size !== undefined && infoEntry.size !== null) {
      setInfoSize(infoEntry.size);
      setInfoLoading(false);
      setInfoError(null);
      return;
    }

    let cancelled = false;
    setInfoSize(null);
    setInfoLoading(true);
    setInfoError(null);

    fs.getDirSize(infoEntry.path)
      .then((size) => {
        if (cancelled) return;
        setInfoSize(size);
        updateEntrySize(dialogTarget.panelId, infoEntry.path, size);
      })
      .catch((error) => {
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
    };
  }, [dialogTarget, fs, infoEntry, openDialog, updateEntrySize]);

  return {
    infoSize,
    infoLoading,
    infoError,
  };
};
