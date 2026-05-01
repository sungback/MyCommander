import { useEffect, useRef, type MouseEvent } from "react";
import type { FileEntry, PanelId } from "../../types/file";
import { isSelectableEntry, type VisibleEntryRow } from "./fileListRows";

interface UseFileListSelectionProps {
  clearSelection: (panel: PanelId) => void;
  currentPath: string;
  cursorIndex: number;
  focusContainer: () => void;
  onSelect: (path: string, toggle: boolean) => void;
  panelId: PanelId;
  selectedItems: Set<string>;
  selectOnly: (panel: PanelId, path: string | null) => void;
  setCursorIndex: (index: number) => void;
  setSelection: (panel: PanelId, paths: string[]) => void;
  showHiddenFiles: boolean;
  visibleRows: VisibleEntryRow[];
}

const clampRowIndex = (targetIndex: number, rowCount: number) =>
  Math.min(Math.max(targetIndex, 0), rowCount - 1);

export const useFileListSelection = ({
  clearSelection,
  currentPath,
  cursorIndex,
  focusContainer,
  onSelect,
  panelId,
  selectedItems,
  selectOnly,
  setCursorIndex,
  setSelection,
  showHiddenFiles,
  visibleRows,
}: UseFileListSelectionProps) => {
  const selectionAnchorIndexRef = useRef<number | null>(null);

  useEffect(() => {
    selectionAnchorIndexRef.current = null;
  }, [currentPath, showHiddenFiles]);

  const getRangePaths = (startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    return visibleRows
      .slice(start, end + 1)
      .map((row) => row.entry)
      .filter(isSelectableEntry)
      .map((entry) => entry.path);
  };

  const moveSelectionToRow = (targetIndex: number) => {
    if (visibleRows.length === 0) return;

    const nextIndex = clampRowIndex(targetIndex, visibleRows.length);
    const nextEntry = visibleRows[nextIndex]?.entry;
    setCursorIndex(nextIndex);
    selectionAnchorIndexRef.current = nextIndex;

    if (!nextEntry) return;
    if (isSelectableEntry(nextEntry)) {
      selectOnly(panelId, nextEntry.path);
      return;
    }

    clearSelection(panelId);
  };

  const extendSelectionToRow = (targetIndex: number) => {
    if (visibleRows.length === 0) return;

    const nextIndex = clampRowIndex(targetIndex, visibleRows.length);
    const anchorIndex = selectionAnchorIndexRef.current ?? cursorIndex;
    const rangePaths = getRangePaths(anchorIndex, nextIndex);
    setCursorIndex(nextIndex);
    setSelection(panelId, rangePaths);
  };

  const handleRowClick = (
    event: MouseEvent<HTMLDivElement>,
    rowIndex: number,
    entry: FileEntry
  ) => {
    setCursorIndex(rowIndex);
    focusContainer();

    if (!isSelectableEntry(entry)) {
      clearSelection(panelId);
      selectionAnchorIndexRef.current = null;
      return;
    }

    const additiveSelection = event.metaKey || event.ctrlKey;

    if (event.shiftKey) {
      const anchorIndex =
        selectionAnchorIndexRef.current ?? cursorIndex ?? rowIndex;
      const rangePaths = getRangePaths(anchorIndex, rowIndex);
      if (additiveSelection) {
        const mergedPaths = new Set(selectedItems);
        rangePaths.forEach((path) => mergedPaths.add(path));
        setSelection(panelId, Array.from(mergedPaths));
      } else {
        setSelection(panelId, rangePaths);
      }
      return;
    }

    selectionAnchorIndexRef.current = rowIndex;

    if (additiveSelection) {
      onSelect(entry.path, true);
      return;
    }

    selectOnly(panelId, entry.path);
  };

  const resetSelectionAnchor = () => {
    selectionAnchorIndexRef.current = null;
  };

  return {
    extendSelectionToRow,
    handleRowClick,
    moveSelectionToRow,
    resetSelectionAnchor,
  };
};
