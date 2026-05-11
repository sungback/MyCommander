import React, { useRef } from "react";
import { FileEntry, ViewMode } from "../../types/file";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useGitStatus } from "../../hooks/useGitStatus";
import { usePanelStore } from "../../store/panelStore";
import { useClipboardStore } from "../../store/clipboardStore";
import { useDialogStore } from "../../store/dialogStore";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { useFileListDrag } from "./useFileListDrag";
import { getVisibleRows } from "./fileListRows";
import { FileListVirtualRows } from "./FileListVirtualRows";
import { useExpandedDirectories } from "./useExpandedDirectories";
import { useFileListKeyboard } from "./useFileListKeyboard";
import { useFileListSelection } from "./useFileListSelection";
import { useFileListVirtualizer } from "./useFileListVirtualizer";

interface FileListProps {
  currentPath: string;
  accessPath: string;
  files: FileEntry[];
  selectedItems: Set<string>;
  cursorIndex: number;
  isActivePanel: boolean;
  panelId: "left" | "right";
  viewMode: ViewMode;
  emptyMessage?: string;
  onOpenFilter?: () => void;
  onSelect: (path: string, toggle: boolean) => void;
  onEnter: (entry: FileEntry) => void;
  setCursorIndex: (idx: number) => void;
}

export const FileList: React.FC<FileListProps> = ({
  currentPath,
  accessPath,
  files,
  selectedItems,
  cursorIndex,
  isActivePanel,
  panelId,
  viewMode,
  emptyMessage,
  onOpenFilter,
  onSelect,
  onEnter,
  setCursorIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { estimateDirSize, getDirSize, listDirectory } = useFileSystem();
  const {
    activeTab,
    setEntrySizeStatus,
    updateEntrySize,
    updateEntrySizeEstimate,
    setSelection,
    selectOnly,
    clearSelection,
    showHiddenFiles,
    sizeCache,
    sizeStatusCache,
  } = usePanelStore(
    useShallow((s) => {
      const key = panelId === "left" ? "leftPanel" : "rightPanel";
      return {
        activeTab: s[key].tabs.find((t) => t.id === s[key].activeTabId),
        setEntrySizeStatus: s.setEntrySizeStatus,
        updateEntrySize: s.updateEntrySize,
        updateEntrySizeEstimate: s.updateEntrySizeEstimate,
        setSelection: s.setSelection,
        selectOnly: s.selectOnly,
        clearSelection: s.clearSelection,
        showHiddenFiles: s.showHiddenFiles,
        sizeCache: s.sizeCache,
        sizeStatusCache: s.sizeStatusCache,
      };
    })
  );
  const refreshKey = activeTab?.lastUpdated ?? 0;
  const { gitStatus } = useGitStatus(accessPath, refreshKey);
  const clipboard = useClipboardStore((s) => s.clipboard);
  const cutPaths = clipboard?.operation === "cut"
    ? new Set(clipboard.paths)
    : null;
  const sortField = activeTab?.sortField ?? "name";
  const sortDirection = activeTab?.sortDirection ?? "asc";
  const expandedChildrenVersion = activeTab?.expandedChildrenVersion ?? 0;
  const focusContainer = () => {
    containerRef.current?.focus({ preventScroll: true });
  };

  const {
    childEntriesByPath,
    expandedPaths,
    toggleExpanded,
  } = useExpandedDirectories({
    currentPath,
    estimateDirSize,
    expandedChildrenVersion,
    files,
    listDirectory,
    panelId,
    refreshKey,
    showHiddenFiles,
    setCursorIndex,
    setEntrySizeStatus,
    updateEntrySizeEstimate,
    focusContainer,
  });

  const visibleRows = getVisibleRows({
    entries: files,
    expandedPaths,
    childEntriesByPath,
    sizeCache,
    sizeStatusCache,
    sortField,
    sortDirection,
  });
  const openPreviewDialog = useDialogStore((s) => s.openPreviewDialog);

  const {
    extendSelectionToRow,
    handleRowClick,
    moveSelectionToRow,
    resetSelectionAnchor,
  } = useFileListSelection({
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
  });

  const { handleKeyDown } = useFileListKeyboard({
    currentPath,
    cursorIndex,
    extendSelectionToRow,
    getDirSize,
    isActivePanel,
    moveSelectionToRow,
    onEnter,
    onOpenFilter,
    onSelect,
    openPreviewDialog,
    panelId,
    setCursorIndex,
    setEntrySizeStatus,
    setSelection,
    showHiddenFiles,
    updateEntrySize,
    visibleRows,
  });

  const {
    dropUiState,
    isLocalDragActive,
    handleMouseDown,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileListDrag({
    panelId,
    accessPath,
    currentPath,
    selectedItems,
    visibleRows,
    containerRef,
  });

  const { rowVirtualizer } = useFileListVirtualizer({
    containerRef,
    cursorIndex,
    isActivePanel,
    rowCount: visibleRows.length,
    setCursorIndex,
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={clsx(
        "flex-1 overflow-y-auto overflow-x-hidden bg-bg-panel focus:outline-none transition-colors duration-200 select-none",
        {
          "bg-emerald-500/5 ring-1 ring-inset ring-emerald-400/35":
            dropUiState.isPanelHovered && dropUiState.dropTargetPath && dropUiState.isDropAllowed,
          "bg-red-500/5 ring-1 ring-inset ring-red-400/35":
            dropUiState.isPanelHovered && dropUiState.dropTargetPath && !dropUiState.isDropAllowed,
        }
      )}
      data-panel-id={panelId}
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          clearSelection(panelId);
          resetSelectionAnchor();
          focusContainer();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      {visibleRows.length === 0 && emptyMessage ? (
        <div className="flex h-full min-h-32 items-center justify-center px-3 text-sm text-text-secondary">
          {emptyMessage}
        </div>
      ) : (
        <FileListVirtualRows
          cutPaths={cutPaths}
          cursorIndex={cursorIndex}
          dropUiState={dropUiState}
          gitStatus={gitStatus}
          isActivePanel={isActivePanel}
          isLocalDragActive={isLocalDragActive}
          onEnter={onEnter}
          onMouseDown={handleMouseDown}
          onRowClick={handleRowClick}
          onToggleExpand={(rowIndex, entry) => {
            void toggleExpanded(rowIndex, entry);
          }}
          selectedItems={selectedItems}
          totalHeight={rowVirtualizer.getTotalSize()}
          viewMode={viewMode}
          virtualItems={rowVirtualizer.getVirtualItems()}
          visibleRows={visibleRows}
        />
      )}
    </div>
  );
};
