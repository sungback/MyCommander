import React, { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileEntry, ViewMode } from "../../types/file";
import { FileItem } from "./FileItem";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useGitStatus } from "../../hooks/useGitStatus";
import { usePanelStore } from "../../store/panelStore";
import { useClipboardStore } from "../../store/clipboardStore";
import { useDialogStore } from "../../store/dialogStore";
import { useSettingsStore } from "../../store/settingsStore";
import { clsx } from "clsx";
import { useFileListDrag } from "./useFileListDrag";
import { getVisibleRows } from "./fileListRows";
import { getFileEntryDataAttributes } from "./fileEntryElement";
import { getGitMarkForEntry } from "./fileListGitMark";
import { useExpandedDirectories } from "./useExpandedDirectories";
import { useFileListKeyboard } from "./useFileListKeyboard";
import { useFileListSelection } from "./useFileListSelection";

interface FileListProps {
  currentPath: string;
  accessPath: string;
  files: FileEntry[];
  selectedItems: Set<string>;
  cursorIndex: number;
  isActivePanel: boolean;
  panelId: "left" | "right";
  viewMode: ViewMode;
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
  onSelect,
  onEnter,
  setCursorIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { getDirSize, listDirectory } = useFileSystem();
  const activeTab = usePanelStore((s) => {
    const key = panelId === "left" ? "leftPanel" : "rightPanel";
    return s[key].tabs.find((t) => t.id === s[key].activeTabId);
  });
  const refreshKey = activeTab?.lastUpdated ?? 0;
  const { gitStatus } = useGitStatus(accessPath, refreshKey);
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const setSelection = usePanelStore((s) => s.setSelection);
  const selectOnly = usePanelStore((s) => s.selectOnly);
  const clearSelection = usePanelStore((s) => s.clearSelection);
  const showHiddenFiles = usePanelStore((s) => s.showHiddenFiles);
  const sizeCache = usePanelStore((s) => s.sizeCache);
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
    expandedChildrenVersion,
    files,
    getDirSize,
    listDirectory,
    panelId,
    refreshKey,
    showHiddenFiles,
    setCursorIndex,
    updateEntrySize,
    focusContainer,
  });

  const visibleRows = getVisibleRows({
    entries: files,
    expandedPaths,
    childEntriesByPath,
    sizeCache,
    sortField,
    sortDirection,
  });
  const openPreviewDialog = useDialogStore((s) => s.openPreviewDialog);
  const settingsFontSize = useSettingsStore((s) => s.fontSize);
  const rowHeight = Math.max(24, settingsFontSize * 2);

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
    onSelect,
    openPreviewDialog,
    panelId,
    setCursorIndex,
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

  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  useEffect(() => {
    if (isActivePanel && cursorIndex >= 0 && cursorIndex < visibleRows.length) {
      rowVirtualizer.scrollToIndex(cursorIndex, { align: "auto" });
    }
  }, [cursorIndex, isActivePanel, rowVirtualizer, visibleRows.length]);

  useEffect(() => {
    if (visibleRows.length === 0) return;
    if (cursorIndex >= visibleRows.length) {
      setCursorIndex(visibleRows.length - 1);
    }
  }, [cursorIndex, setCursorIndex, visibleRows.length]);

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
      <div
        className="relative min-h-full w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const row = visibleRows[virtualItem.index];
          const entry = row.entry;
          return (
            <div
              key={`${entry.path}:${row.depth}`}
              className="absolute top-0 left-0 w-full"
              {...getFileEntryDataAttributes(entry, virtualItem.index)}
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              onMouseDown={(e) => handleMouseDown(e, entry)}
            >
              <FileItem
                entry={entry}
                depth={row.depth}
                canExpand={row.canExpand}
                isExpanded={row.isExpanded}
                isSelected={selectedItems.has(entry.path)}
                isCursor={cursorIndex === virtualItem.index}
                isActivePanel={isActivePanel}
                isDragSource={isLocalDragActive && selectedItems.has(entry.path)}
                isCut={cutPaths?.has(entry.path) ?? false}
                dropHint={
                  dropUiState.dropTargetPath === entry.path
                    ? dropUiState.isDropAllowed
                      ? "copy"
                      : "blocked"
                    : null
                }
                viewMode={viewMode}
                gitMark={getGitMarkForEntry(entry, gitStatus)}
                onClick={(event) => {
                  handleRowClick(event, virtualItem.index, entry);
                }}
                onDoubleClick={() => onEnter(entry)}
                onToggleExpand={() => {
                  void toggleExpanded(virtualItem.index, entry);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
