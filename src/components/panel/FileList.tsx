import React, { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileEntry, ViewMode } from "../../types/file";
import { FileItem } from "./FileItem";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useGitStatus } from "../../hooks/useGitStatus";
import { usePanelStore } from "../../store/panelStore";
import { useClipboardStore } from "../../store/clipboardStore";
import { sortEntries } from "../../utils/panelHelpers";
import { useDialogStore } from "../../store/dialogStore";
import { useSettingsStore } from "../../store/settingsStore";
import { clsx } from "clsx";
import { useFileListDrag, VisibleEntryRow } from "./useFileListDrag";

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

const isSelectableEntry = (entry: FileEntry) => entry.name !== "..";

const getVisibleRows = (
  entries: FileEntry[],
  expandedPaths: Set<string>,
  childEntriesByPath: Record<string, FileEntry[]>,
  sizeCache: Record<string, number>,
  sortField: string,
  sortDirection: "asc" | "desc",
  depth = 0
): VisibleEntryRow[] => {
  const rows: VisibleEntryRow[] = [];

  for (const entry of entries) {
    const canExpand = entry.kind === "directory" && entry.name !== "..";
    const isExpanded = canExpand && expandedPaths.has(entry.path);

    const cachedSize = sizeCache[entry.path.normalize("NFC")];
    const resolvedEntry =
      cachedSize !== undefined ? { ...entry, size: cachedSize } : entry;

    rows.push({ entry: resolvedEntry, depth, canExpand, isExpanded });

    if (!isExpanded) continue;

    const children = childEntriesByPath[entry.path] ?? [];
    // Apply sizeCache to children before sorting so that dynamically updated sizes sort properly
    const resolvedChildren = children.map(child => {
      const cSize = sizeCache[child.path.normalize("NFC")];
      return cSize !== undefined ? { ...child, size: cSize } : child;
    });

    // Sort children
    const filteredChildren = resolvedChildren.filter((child) => child.name !== "..");
    const sortedChildren = sortEntries(filteredChildren, sortField, sortDirection);

    rows.push(
      ...getVisibleRows(
        sortedChildren,
        expandedPaths,
        childEntriesByPath,
        sizeCache,
        sortField,
        sortDirection,
        depth + 1
      )
    );
  }

  return rows;
};

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
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [childEntriesByPath, setChildEntriesByPath] = useState<
    Record<string, FileEntry[]>
  >({});
  
  const selectionAnchorIndexRef = useRef<number | null>(null);
  const searchStringRef = useRef<string>("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandedPathsRef = useRef<Set<string>>(new Set());

  const getGitMark = (entry: FileEntry): string | undefined => {
    if (!gitStatus) return undefined;

    if (entry.kind === "directory") {
      // Folder: check if any child file has changes
      const name = entry.name;
      const hasChanges = gitStatus.modified.some(p => p.startsWith(name + "/")) ||
                         gitStatus.added.some(p => p.startsWith(name + "/")) ||
                         gitStatus.deleted.some(p => p.startsWith(name + "/")) ||
                         gitStatus.untracked.some(p => p.startsWith(name + "/"));
      return hasChanges ? "~" : undefined;
    } else {
      // File: check direct name match in git status
      const name = entry.name;
      if (gitStatus.modified.includes(name)) return "M";
      if (gitStatus.added.includes(name)) return "A";
      if (gitStatus.deleted.includes(name)) return "D";
      if (gitStatus.untracked.includes(name)) return "?";
    }

    return undefined;
  };

  const visibleRows = getVisibleRows(
    files,
    expandedPaths,
    childEntriesByPath,
    sizeCache,
    sortField as string,
    sortDirection as "asc" | "desc"
  );
  const openPreviewDialog = useDialogStore((s) => s.openPreviewDialog);
  const settingsFontSize = useSettingsStore((s) => s.fontSize);
  const rowHeight = Math.max(24, settingsFontSize * 2);

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
    setExpandedPaths(new Set());
    expandedPathsRef.current = new Set();
    setChildEntriesByPath({});
    selectionAnchorIndexRef.current = null;
    searchStringRef.current = "";
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, [currentPath, showHiddenFiles]);

  useEffect(() => {
    expandedPathsRef.current = expandedPaths;
  }, [expandedPaths]);

  useEffect(() => {
    const expandedPathsToRefresh = [...expandedPathsRef.current];

    if (expandedPathsToRefresh.length === 0) {
      return;
    }

    let cancelled = false;

    const refreshExpandedDirectories = async () => {
      const results = await Promise.all(
        expandedPathsToRefresh.map(async (path) => {
          try {
            const children = await listDirectory(path, showHiddenFiles);
            return {
              path,
              children: children.filter((child) => child.name !== ".."),
            };
          } catch (error) {
            console.error(`Failed to refresh child entries for ${path}:`, error);
            return {
              path,
              children: null as FileEntry[] | null,
            };
          }
        })
      );

      if (cancelled) {
        return;
      }

      const nextExpandedPaths = new Set(expandedPathsRef.current);
      for (const result of results) {
        if (result.children === null) {
          nextExpandedPaths.delete(result.path);
        }
      }

      expandedPathsRef.current = nextExpandedPaths;
      setExpandedPaths(nextExpandedPaths);
      setChildEntriesByPath((current) => {
        const next = { ...current };

        for (const result of results) {
          if (result.children === null) {
            delete next[result.path];
            continue;
          }

          next[result.path] = result.children;
        }

        return next;
      });
    };

    void refreshExpandedDirectories();

    return () => {
      cancelled = true;
    };
  }, [currentPath, expandedChildrenVersion, files, listDirectory, refreshKey, showHiddenFiles]);

  useEffect(() => {
    if (visibleRows.length === 0) return;
    if (cursorIndex >= visibleRows.length) {
      setCursorIndex(visibleRows.length - 1);
    }
  }, [cursorIndex, setCursorIndex, visibleRows.length]);

  // ─── Tree expand/collapse ─────────────────────────────────────────────────
  const toggleExpanded = async (rowIndex: number, entry: FileEntry) => {
    if (entry.kind !== "directory" || entry.name === "..") return;
    setCursorIndex(rowIndex);
    containerRef.current?.focus({ preventScroll: true });

    if (expandedPaths.has(entry.path)) {
      setExpandedPaths((current) => {
        const next = new Set(current);
        next.delete(entry.path);
        return next;
      });
      return;
    }

    if (!childEntriesByPath[entry.path]) {
      try {
        const children = await listDirectory(entry.path, showHiddenFiles);
        const validChildren = children.filter((child) => child.name !== "..");
        setChildEntriesByPath((current) => ({
          ...current,
          [entry.path]: validChildren,
        }));
        validChildren.forEach((child) => {
          if (
            child.kind === "directory" &&
            (child.size === undefined || child.size === null)
          ) {
            getDirSize(child.path)
              .then((size) => updateEntrySize(panelId, child.path, size))
              .catch((err) =>
                console.error("Failed to calculate child dir size:", err)
              );
          }
        });
      } catch (error) {
        console.error(
          `Failed to preview child entries for ${entry.path}:`,
          error
        );
        return;
      }
    }

    if (entry.size === undefined || entry.size === null) {
      getDirSize(entry.path)
        .then((size) => updateEntrySize(panelId, entry.path, size))
        .catch((err) => console.error("Failed to calculate dir size:", err));
    }

    setExpandedPaths((current) => {
      const next = new Set(current);
      next.add(entry.path);
      return next;
    });
  };

  // ─── Selection helpers ────────────────────────────────────────────────────
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
    const nextIndex = Math.min(
      Math.max(targetIndex, 0),
      visibleRows.length - 1
    );
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
    const nextIndex = Math.min(
      Math.max(targetIndex, 0),
      visibleRows.length - 1
    );
    const anchorIndex = selectionAnchorIndexRef.current ?? cursorIndex;
    const rangePaths = getRangePaths(anchorIndex, nextIndex);
    setCursorIndex(nextIndex);
    setSelection(panelId, rangePaths);
  };

  // ─── Click handler ────────────────────────────────────────────────────────
  const handleRowClick = (
    event: React.MouseEvent<HTMLDivElement>,
    rowIndex: number,
    entry: FileEntry
  ) => {
    setCursorIndex(rowIndex);
    containerRef.current?.focus({ preventScroll: true });

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
          selectionAnchorIndexRef.current = null;
          containerRef.current?.focus({ preventScroll: true });
        }
      }}
      onKeyDown={(e) => {
        if (!isActivePanel) return;
        if (visibleRows.length === 0) return;

        const current = visibleRows[cursorIndex]?.entry;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (e.shiftKey) extendSelectionToRow(cursorIndex + 1);
          else moveSelectionToRow(cursorIndex + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (e.shiftKey) extendSelectionToRow(cursorIndex - 1);
          else moveSelectionToRow(cursorIndex - 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveSelectionToRow(0);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveSelectionToRow(visibleRows.length - 1);
        } else if (e.key === "Insert") {
          e.preventDefault();
          if (current) onSelect(current.path, true);
          setCursorIndex(Math.min(cursorIndex + 1, visibleRows.length - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (current) onEnter(current);
        } else if (e.code === "Space") {
          e.preventDefault();
          e.stopPropagation();
          if (current) {
            if (current.kind === "file") {
              // Open Quick Preview for files
              openPreviewDialog({ panelId, path: current.path });
            } else {
              // Toggle selection + calculate size for directories
              onSelect(current.path, true);
              if (current.kind === "directory" && current.name !== "..") {
                getDirSize(current.path)
                  .then((size) => updateEntrySize(panelId, current.path, size))
                  .catch((err) =>
                    console.error("Failed to calculate dir size:", err)
                  );
              }
            }
          }
        } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyA") {
          e.preventDefault();
          const allPaths = visibleRows
            .map((r) => r.entry)
            .filter(isSelectableEntry)
            .map((entry) => entry.path);
          setSelection(panelId, allPaths);
        } else if (
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key !== " "
        ) {
          e.preventDefault();
          if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
          searchStringRef.current += e.key.toLowerCase();
          const query = searchStringRef.current;
          const matchIndex = visibleRows.findIndex((row) =>
            row.entry.name.toLowerCase().startsWith(query)
          );
          if (matchIndex !== -1) moveSelectionToRow(matchIndex);
          searchTimeoutRef.current = setTimeout(() => {
            searchStringRef.current = "";
          }, 800);
        }
      }}
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
              data-entry-index={virtualItem.index}
              data-entry-path={entry.path}
              data-entry-name={entry.name}
              data-entry-kind={entry.kind}
              data-entry-is-hidden={entry.isHidden ? "true" : "false"}
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
                gitMark={getGitMark(entry)}
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
