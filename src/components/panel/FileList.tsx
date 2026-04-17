import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileEntry, ViewMode } from "../../types/file";
import { FileItem } from "./FileItem";
import { useFileSystem } from "../../hooks/useFileSystem";
import { usePanelStore, sortEntries } from "../../store/panelStore";
import { useDialogStore } from "../../store/dialogStore";
import { useUiStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { clsx } from "clsx";
import { isSameOrNestedPath } from "../../utils/path";
import { refreshPanelsForDirectories } from "../../store/panelRefresh";

interface FileListProps {
  currentPath: string;
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

interface VisibleEntryRow {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  canExpand: boolean;
}

const DRAG_THRESHOLD_PX = 6;

const isSelectableEntry = (entry: FileEntry) => entry.name !== "..";

// ─── Module-level shared state for cross-panel drag communication ────────────
// Both FileList instances (left + right) share this object.
const sharedDragState = {
  hoveredPanel: null as "left" | "right" | null,
  dropTargetPath: null as string | null,
  isDropAllowed: false,
  blockedReason: null as string | null,
};

let clearStatusMessageTimeoutId: number | undefined;

const showTransientStatusMessage = (message: string, durationMs: number = 1800) => {
  const { setStatusMessage } = useUiStore.getState();
  if (clearStatusMessageTimeoutId !== undefined) {
    window.clearTimeout(clearStatusMessageTimeoutId);
  }

  setStatusMessage(message);
  clearStatusMessageTimeoutId = window.setTimeout(() => {
    useUiStore.getState().setStatusMessage(null);
    clearStatusMessageTimeoutId = undefined;
  }, durationMs);
};

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

/** Small document icon rendered via canvas, cached after first call */
let _cachedDragIcon: string | null = null;
const getDragIcon = (): string => {
  if (_cachedDragIcon) return _cachedDragIcon;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(8, 4, 28, 40, 4);
  else ctx.rect(8, 4, 28, 40);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(14, 14, 16, 2);
  ctx.fillRect(14, 20, 16, 2);
  ctx.fillRect(14, 26, 10, 2);
  _cachedDragIcon = canvas.toDataURL("image/png");
  return _cachedDragIcon;
};

export const FileList: React.FC<FileListProps> = ({
  currentPath,
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
  const { checkCopyConflicts, copyFiles, getDirSize, listDirectory } = useFileSystem();
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const setSelection = usePanelStore((s) => s.setSelection);
  const selectOnly = usePanelStore((s) => s.selectOnly);
  const clearSelection = usePanelStore((s) => s.clearSelection);
  const showHiddenFiles = usePanelStore((s) => s.showHiddenFiles);
  const sizeCache = usePanelStore((s) => s.sizeCache);
  const setDragInfo = usePanelStore((s) => s.setDragInfo);
  const clipboard = usePanelStore((s) => s.clipboard);
  const cutPaths = clipboard?.operation === "cut"
    ? new Set(clipboard.paths)
    : null;
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const activeTab = usePanelStore((s) => {
    const key = panelId === "left" ? "leftPanel" : "rightPanel";
    return s[key].tabs.find((t) => t.id === s[key].activeTabId);
  });
  const sortField = activeTab?.sortField ?? "name";
  const sortDirection = activeTab?.sortDirection ?? "asc";
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [childEntriesByPath, setChildEntriesByPath] = useState<
    Record<string, FileEntry[]>
  >({});
  const [dropUiState, setDropUiState] = useState<{
    isPanelHovered: boolean;
    dropTargetPath: string | null;
    isDropAllowed: boolean;
  }>({
    isPanelHovered: false,
    dropTargetPath: null,
    isDropAllowed: false,
  });
  const [isLocalDragActive, setIsLocalDragActive] = useState(false);
  const selectionAnchorIndexRef = useRef<number | null>(null);
  const searchStringRef = useRef<string>("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Counter for HTML5 drag events (for external Finder→App drops)
  const dragCounterRef = useRef(0);

  // State for mouse-based drag (panel→panel + Finder drag-out)
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    paths: string[];
    dragging: boolean;       // crossed threshold?
    nativeDragStarted: boolean; // startDrag() called?
  } | null>(null);

  const visibleRows = getVisibleRows(
    files,
    expandedPaths,
    childEntriesByPath,
    sizeCache,
    sortField as string,
    sortDirection as "asc" | "desc"
  );
  const openDragCopyDialog = useDialogStore((s) => s.openDragCopyDialog);
  const openPreviewDialog = useDialogStore((s) => s.openPreviewDialog);
  const settingsFontSize = useSettingsStore((s) => s.fontSize);
  const rowHeight = Math.max(24, settingsFontSize * 2);

  const handleDraggedCopy = async (
    paths: string[],
    targetPath: string,
    targetPanelId: "left" | "right"
  ) => {
    const conflicts = await checkCopyConflicts(paths, targetPath);

    if (conflicts.length > 0) {
      setActivePanel(panelId);
      openDragCopyDialog({
        sourcePanelId: panelId,
        targetPanelId,
        sourcePaths: paths,
        targetPath,
      });
      return false;
    }

    await copyFiles(paths, targetPath);
    refreshPanelsForDirectories([currentPath, targetPath]);
    showTransientStatusMessage("선택한 파일을 복사했습니다.");
    return true;
  };

  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const updateDropUiState = (nextState: typeof dropUiState) => {
    setDropUiState((current) => {
      if (
        current.isPanelHovered === nextState.isPanelHovered &&
        current.dropTargetPath === nextState.dropTargetPath &&
        current.isDropAllowed === nextState.isDropAllowed
      ) {
        return current;
      }

      return nextState;
    });
  };

  const clearDropTargetForPanel = (targetPanel: "left" | "right") => {
    if (sharedDragState.hoveredPanel === targetPanel) {
      sharedDragState.hoveredPanel = null;
      sharedDragState.dropTargetPath = null;
      sharedDragState.isDropAllowed = false;
      sharedDragState.blockedReason = null;
    }
  };

  useEffect(() => {
    if (isActivePanel && cursorIndex >= 0 && cursorIndex < visibleRows.length) {
      rowVirtualizer.scrollToIndex(cursorIndex, { align: "auto" });
    }
  }, [cursorIndex, isActivePanel, rowVirtualizer, visibleRows.length]);

  useEffect(() => {
    setExpandedPaths(new Set());
    setChildEntriesByPath({});
    selectionAnchorIndexRef.current = null;
    searchStringRef.current = "";
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, [currentPath, showHiddenFiles]);

  useEffect(() => {
    if (visibleRows.length === 0) return;
    if (cursorIndex >= visibleRows.length) {
      setCursorIndex(visibleRows.length - 1);
    }
  }, [cursorIndex, setCursorIndex, visibleRows.length]);

  // ─── Document-level mouse listeners ────────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      const activeDragInfo = usePanelStore.getState().dragInfo;

      // Update hover state for ANY active drag (from this or other panel)
      if ((state?.dragging || activeDragInfo) && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isOverContainer =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        if (isOverContainer && activeDragInfo?.sourcePanel !== panelId) {
          sharedDragState.hoveredPanel = panelId;
        }

        const rowElement = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("[data-entry-path]") as HTMLElement | null;
        const rowPath =
          rowElement && containerRef.current.contains(rowElement)
            ? rowElement.dataset.entryPath ?? null
            : null;
        const targetEntry = rowPath
          ? visibleRows.find((row) => row.entry.path === rowPath)?.entry ?? null
          : null;
        const canAcceptDrop =
          Boolean(targetEntry) &&
          targetEntry?.kind === "directory" &&
          targetEntry.name !== ".." &&
          Boolean(activeDragInfo);

        if (isOverContainer && canAcceptDrop && activeDragInfo) {
          const blockedReason = activeDragInfo.paths.includes(targetEntry!.path)
            ? "자기 자신에게는 복사할 수 없습니다."
            : activeDragInfo.directoryPaths.some((sourceDir) =>
              isSameOrNestedPath(sourceDir, targetEntry!.path)
            )
              ? "폴더를 자기 자신 안이나 하위 폴더로 복사할 수 없습니다."
              : null;
          const isDropAllowed = blockedReason === null;

          sharedDragState.dropTargetPath = targetEntry!.path;
          sharedDragState.isDropAllowed = isDropAllowed;
          sharedDragState.blockedReason = blockedReason;
          updateDropUiState({
            isPanelHovered: true,
            dropTargetPath: targetEntry!.path,
            isDropAllowed,
          });
        } else {
          if (activeDragInfo?.sourcePanel === panelId) {
            sharedDragState.dropTargetPath = null;
            sharedDragState.isDropAllowed = false;
            sharedDragState.blockedReason = null;
          } else if (sharedDragState.hoveredPanel === panelId) {
            sharedDragState.dropTargetPath = null;
            sharedDragState.isDropAllowed = false;
            sharedDragState.blockedReason = null;
          }

          if (!isOverContainer) {
            clearDropTargetForPanel(panelId);
            updateDropUiState({
              isPanelHovered: false,
              dropTargetPath: null,
              isDropAllowed: false,
            });
          } else {
            updateDropUiState({
              isPanelHovered: true,
              dropTargetPath: null,
              isDropAllowed: false,
            });
          }
        }
      }

      if (!state || state.nativeDragStarted) return;

      // Step 1: Detect drag threshold
      if (!state.dragging) {
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
          const directoryPaths = state.paths.filter((path) => {
            const entry = visibleRows.find((row) => row.entry.path === path)?.entry;
            return entry?.kind === "directory";
          });
          state.dragging = true;
          // Signal other panel that a drag is in progress from this panel
          setDragInfo({ paths: state.paths, directoryPaths, sourcePanel: panelId });
          setIsLocalDragActive(true);
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }
        return;
      }

      // Step 2: If mouse has left the app window → hand off to native drag
      const outsideWindow =
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight;

      if (outsideWindow) {
        state.nativeDragStarted = true;
        document.body.style.cursor = "";

        startDrag({ item: state.paths, icon: getDragIcon() })
          .then(() => {
            setDragInfo(null);
            sharedDragState.hoveredPanel = null;
            sharedDragState.dropTargetPath = null;
            sharedDragState.isDropAllowed = false;
            sharedDragState.blockedReason = null;
            dragStateRef.current = null;
            setIsLocalDragActive(false);
            updateDropUiState({
              isPanelHovered: false,
              dropTargetPath: null,
              isDropAllowed: false,
            });
          })
          .catch(console.error);
      }
    };

    const handleMouseUp = () => {
      const state = dragStateRef.current;
      if (!state) return;

      // Native drag has taken over — handled by startDrag promise
      if (state.nativeDragStarted) {
        dragStateRef.current = null;
        return;
      }

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (state.dragging) {
        const activeDragInfo = usePanelStore.getState().dragInfo;
        const targetPanel = sharedDragState.hoveredPanel;
        const samePanelDropTarget =
          targetPanel === null && activeDragInfo?.sourcePanel === panelId
            ? sharedDragState.dropTargetPath
            : null;

        if (samePanelDropTarget) {
          const targetPath = samePanelDropTarget;
          const isDropAllowed = sharedDragState.isDropAllowed;
          const blockedReason = sharedDragState.blockedReason;

          setDragInfo(null);
          sharedDragState.hoveredPanel = null;
          sharedDragState.dropTargetPath = null;
          sharedDragState.isDropAllowed = false;
          sharedDragState.blockedReason = null;
          dragStateRef.current = null;
          setIsLocalDragActive(false);
          updateDropUiState({
            isPanelHovered: false,
            dropTargetPath: null,
            isDropAllowed: false,
          });

          if (!isDropAllowed) {
            showTransientStatusMessage(blockedReason ?? "여기로는 복사할 수 없습니다.");
            return;
          }

          void handleDraggedCopy(state.paths, targetPath, panelId)
            .then(() => {
            })
            .catch((error) => {
              console.error("Failed to copy dragged files:", error);
              showTransientStatusMessage("파일을 복사하지 못했습니다.");
            });
          return;
        }

        // Internal panel-to-panel drop
        if (targetPanel && targetPanel !== panelId) {
          const stateSnapshot = usePanelStore.getState();
          const destinationPanel =
            targetPanel === "left" ? stateSnapshot.leftPanel : stateSnapshot.rightPanel;
          const targetPath = sharedDragState.dropTargetPath ?? destinationPanel.currentPath;

          void handleDraggedCopy(state.paths, targetPath, targetPanel).catch((error) => {
            console.error("Failed to copy dragged files:", error);
            showTransientStatusMessage("파일을 복사하지 못했습니다.");
          });
        }
      }

      setDragInfo(null);
      sharedDragState.hoveredPanel = null;
      sharedDragState.dropTargetPath = null;
      sharedDragState.isDropAllowed = false;
      sharedDragState.blockedReason = null;
      dragStateRef.current = null;
      setIsLocalDragActive(false);
      updateDropUiState({
        isPanelHovered: false,
        dropTargetPath: null,
        isDropAllowed: false,
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    checkCopyConflicts,
    copyFiles,
    currentPath,
    openDragCopyDialog,
    panelId,
    setActivePanel,
    setDragInfo,
    visibleRows,
  ]);

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

  // ─── Mouse-down: record drag intent ──────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent, entry: FileEntry) => {
    if (entry.name === "..") return;
    if (e.button !== 0) return;

    // Prevent text selection immediately on mousedown
    e.preventDefault();

    const pathsToDrag = selectedItems.has(entry.path)
      ? Array.from(selectedItems)
      : [entry.path];

    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      paths: pathsToDrag,
      dragging: false,
      nativeDragStarted: false,
    };
  };

  // ─── HTML5 drag handlers (for receiving external drops from Finder) ───────
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;

    const activeDragInfo = usePanelStore.getState().dragInfo;

    // If our app's drag is active, ignore — handled by mouseup
    if (activeDragInfo) {
      return;
    }

    // External drop from Finder/OS → copy files in
    const externalFiles = Array.from(e.dataTransfer.files);
    if (externalFiles.length > 0) {
      const paths = externalFiles
        .map((f) => (f as any).path as string)
        .filter(Boolean);
      if (paths.length > 0) {
        try {
          await invoke("copy_files", {
            source_paths: paths,
            target_path: currentPath,
          });
        } catch (error) {
          console.error("Failed to copy external files:", error);
        }
      }
    }
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
