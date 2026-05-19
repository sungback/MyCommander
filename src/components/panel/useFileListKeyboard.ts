import { useEffect, useRef, type KeyboardEvent } from "react";
import type { DirectorySizeStatus, PanelId } from "../../types/file";
import {
  cancelManualDirectorySizeScan,
  scanDirectorySizeWithProgress,
} from "../../hooks/manualDirectorySizeScan";
import type { DirectorySizeScanResult } from "../../hooks/tauriCommands/fileCommands";
import { showTransientToast } from "../../store/toastStore";
import { isSelectableEntry, type VisibleEntryRow } from "./fileListRows";

interface UseFileListKeyboardProps {
  cancelDirSizeScan: (scanId: string) => Promise<void>;
  currentPath: string;
  cursorIndex: number;
  extendSelectionToRow: (targetIndex: number) => void;
  isActivePanel: boolean;
  moveSelectionToRow: (targetIndex: number) => void;
  onEnter: (entry: VisibleEntryRow["entry"]) => void;
  onOpenFilter?: () => void;
  onSelect: (path: string, toggle: boolean) => void;
  openPreviewDialog: (request: { panelId: PanelId; path: string }) => void;
  panelId: PanelId;
  scanDirSize: (path: string, scanId: string) => Promise<DirectorySizeScanResult>;
  setCursorIndex: (index: number) => void;
  setEntrySizeStatus: (
    panel: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  setSelection: (panel: PanelId, paths: string[]) => void;
  showHiddenFiles: boolean;
  updateEntrySize: (panel: PanelId, path: string, size: number) => void;
  updateEntrySizeEstimate: (
    panel: PanelId,
    path: string,
    size: number,
    status: Extract<DirectorySizeStatus, "estimated" | "partial">
  ) => void;
  updateEntrySizeProgress: (panel: PanelId, path: string, size: number) => void;
  visibleRows: VisibleEntryRow[];
}

export const useFileListKeyboard = ({
  cancelDirSizeScan,
  currentPath,
  cursorIndex,
  extendSelectionToRow,
  isActivePanel,
  moveSelectionToRow,
  onEnter,
  onOpenFilter,
  onSelect,
  openPreviewDialog,
  panelId,
  scanDirSize,
  setCursorIndex,
  setEntrySizeStatus,
  setSelection,
  showHiddenFiles,
  updateEntrySize,
  updateEntrySizeEstimate,
  updateEntrySizeProgress,
  visibleRows,
}: UseFileListKeyboardProps) => {
  const searchStringRef = useRef("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTypeAheadTimeout = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  };

  const resetTypeAhead = () => {
    searchStringRef.current = "";
    clearTypeAheadTimeout();
  };

  useEffect(() => {
    resetTypeAhead();
  }, [currentPath, showHiddenFiles]);

  useEffect(() => resetTypeAhead, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isActivePanel) return;

    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      onOpenFilter?.();
      return;
    }

    if (visibleRows.length === 0) return;

    const current = visibleRows[cursorIndex]?.entry;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (event.shiftKey) extendSelectionToRow(cursorIndex + 1);
      else moveSelectionToRow(cursorIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (event.shiftKey) extendSelectionToRow(cursorIndex - 1);
      else moveSelectionToRow(cursorIndex - 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelectionToRow(0);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSelectionToRow(visibleRows.length - 1);
      return;
    }

    if (event.key === "Insert") {
      event.preventDefault();
      if (current) onSelect(current.path, true);
      setCursorIndex(Math.min(cursorIndex + 1, visibleRows.length - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (current) onEnter(current);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      event.stopPropagation();
      if (!current) return;

      if (current.kind === "file") {
        openPreviewDialog({ panelId, path: current.path });
        return;
      }

      onSelect(current.path, true);
      if (current.kind === "directory" && current.name !== "..") {
        cancelManualDirectorySizeScan(current.path)
          .then((cancelled) => {
            if (cancelled) {
              return null;
            }

            return scanDirectorySizeWithProgress({
              cancelDirSizeScan,
              panelId,
              path: current.path,
              scanDirSize,
              setEntrySizeStatus,
              updateEntrySize,
              updateEntrySizeEstimate,
              updateEntrySizeProgress,
            });
          })
          .catch((error) => {
            setEntrySizeStatus(panelId, current.path, "error");
            console.error("Failed to calculate dir size:", error);
            const message = error instanceof Error ? error.message : String(error);
            showTransientToast(`폴더 크기를 계산하지 못했습니다: ${message}`, {
              tone: "error",
              durationMs: 2500,
            });
          });
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.code === "KeyA") {
      event.preventDefault();
      const allPaths = visibleRows
        .map((row) => row.entry)
        .filter(isSelectableEntry)
        .map((entry) => entry.path);
      setSelection(panelId, allPaths);
      return;
    }

    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key !== " "
    ) {
      event.preventDefault();
      clearTypeAheadTimeout();
      searchStringRef.current += event.key.toLowerCase();
      const query = searchStringRef.current;
      const matchIndex = visibleRows.findIndex((row) =>
        row.entry.name.toLowerCase().startsWith(query)
      );
      if (matchIndex !== -1) moveSelectionToRow(matchIndex);
      searchTimeoutRef.current = setTimeout(() => {
        searchStringRef.current = "";
      }, 800);
    }
  };

  return {
    handleKeyDown,
  };
};
