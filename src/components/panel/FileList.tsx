import React, { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileEntry } from "../../types/file";
import { FileItem } from "./FileItem";
import { useFileSystem } from "../../hooks/useFileSystem";
import { usePanelStore } from "../../store/panelStore";

interface FileListProps {
  currentPath: string;
  files: FileEntry[];
  selectedItems: Set<string>;
  cursorIndex: number;
  isActivePanel: boolean;
  panelId: "left" | "right";
  onSelect: (path: string, toggle: boolean) => void;
  onEnter: (entry: FileEntry) => void;
  setCursorIndex: (idx: number) => void;
}

interface VisibleEntryRow {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  canExpand: boolean;
}

const isSelectableEntry = (entry: FileEntry) => entry.name !== "..";

const getVisibleRows = (
  entries: FileEntry[],
  expandedPaths: Set<string>,
  childEntriesByPath: Record<string, FileEntry[]>,
  depth = 0
): VisibleEntryRow[] => {
  const rows: VisibleEntryRow[] = [];

  for (const entry of entries) {
    const canExpand = entry.kind === "directory" && entry.name !== "..";
    const isExpanded = canExpand && expandedPaths.has(entry.path);

    rows.push({
      entry,
      depth,
      canExpand,
      isExpanded,
    });

    if (!isExpanded) {
      continue;
    }

    const children = childEntriesByPath[entry.path] ?? [];
    const filteredChildren = children.filter((child) => child.name !== "..");
    rows.push(...getVisibleRows(filteredChildren, expandedPaths, childEntriesByPath, depth + 1));
  }

  return rows;
};

export const FileList: React.FC<FileListProps> = ({
  currentPath,
  files,
  selectedItems,
  cursorIndex,
  isActivePanel,
  panelId,
  onSelect,
  onEnter,
  setCursorIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { getDirSize, listDirectory } = useFileSystem();
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const setSelection = usePanelStore((s) => s.setSelection);
  const selectOnly = usePanelStore((s) => s.selectOnly);
  const clearSelection = usePanelStore((s) => s.clearSelection);
  const showHiddenFiles = usePanelStore((s) => s.showHiddenFiles);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [childEntriesByPath, setChildEntriesByPath] = useState<Record<string, FileEntry[]>>({});
  const selectionAnchorIndexRef = useRef<number | null>(null);
  const visibleRows = getVisibleRows(files, expandedPaths, childEntriesByPath);

  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 28, // Height of one FileItem row
    overscan: 10,
  });

  // Ensure cursor is always visible
  useEffect(() => {
    if (isActivePanel && cursorIndex >= 0 && cursorIndex < visibleRows.length) {
      rowVirtualizer.scrollToIndex(cursorIndex, { align: "auto" });
    }
  }, [cursorIndex, isActivePanel, rowVirtualizer, visibleRows.length]);

  useEffect(() => {
    setExpandedPaths(new Set());
    setChildEntriesByPath({});
    selectionAnchorIndexRef.current = null;
  }, [currentPath, showHiddenFiles]);

  useEffect(() => {
    if (visibleRows.length === 0) {
      return;
    }

    if (cursorIndex >= visibleRows.length) {
      setCursorIndex(visibleRows.length - 1);
    }
  }, [cursorIndex, setCursorIndex, visibleRows.length]);

  const toggleExpanded = async (rowIndex: number, entry: FileEntry) => {
    if (entry.kind !== "directory" || entry.name === "..") {
      return;
    }

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
        setChildEntriesByPath((current) => ({
          ...current,
          [entry.path]: children.filter((child) => child.name !== ".."),
        }));
      } catch (error) {
        console.error(`Failed to preview child entries for ${entry.path}:`, error);
        return;
      }
    }

    setExpandedPaths((current) => {
      const next = new Set(current);
      next.add(entry.path);
      return next;
    });
  };

  const getRangePaths = (startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    return visibleRows
      .slice(start, end + 1)
      .map((row) => row.entry)
      .filter(isSelectableEntry)
      .map((entry) => entry.path);
  };

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
      const anchorIndex = selectionAnchorIndexRef.current ?? cursorIndex ?? rowIndex;
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

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden bg-bg-panel focus:outline-none"
      tabIndex={0}
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
          setCursorIndex(Math.min(cursorIndex + 1, visibleRows.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setCursorIndex(Math.max(cursorIndex - 1, 0));
        } else if (e.key === "Insert") {
          e.preventDefault();
          if (current) onSelect(current.path, true);
          setCursorIndex(Math.min(cursorIndex + 1, visibleRows.length - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (current) onEnter(current);
        } else if (e.key === "Space") {
          e.preventDefault();
          e.stopPropagation(); // Prevent space from scrolling the container
          if (current) {
            onSelect(current.path, true);
            // Calculate dir size if it's a directory
            if (current.kind === "directory" && current.name !== "..") {
              getDirSize(current.path).then(size => {
                updateEntrySize(panelId, current.path, size);
              }).catch(err => {
                console.error("Failed to calculate dir size:", err);
              });
            }
          }
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
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <FileItem
                entry={entry}
                depth={row.depth}
                canExpand={row.canExpand}
                isExpanded={row.isExpanded}
                isSelected={selectedItems.has(entry.path)}
                isCursor={cursorIndex === virtualItem.index}
                isActivePanel={isActivePanel}
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
