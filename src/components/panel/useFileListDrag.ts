import React, { useEffect, useRef, useState } from "react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { FileEntry } from "../../types/file";
import { useFileSystem } from "../../hooks/useFileSystem";
import { usePanelStore } from "../../store/panelStore";
import { useDragStore } from "../../store/dragStore";
import { useDialogStore } from "../../store/dialogStore";
import { coalescePanelPath } from "../../utils/path";
import { showTransientToast } from "../../store/toastStore";
import { getExternalDropPaths } from "./fileListExternalDrop";
import {
  clearSharedDropTargetForPanel,
  resetSharedDragState,
  sharedDragState,
  sharedPanelPaths,
} from "./fileListDragSharedState";
import {
  collapseNestedDirectoryPaths,
  getBlockedDropReason,
  getPanelIdFromElement,
  resolveCrossPanelDropIntent,
  resolveMouseUpTargetPanel,
  resolveSamePanelDropIntent,
  resolveSamePanelBackgroundDropTarget,
} from "./fileListDragRules";
import { findFileEntryElement } from "./fileEntryElement";
import type { VisibleEntryRow } from "./fileListRows";

const DRAG_THRESHOLD_PX = 6;
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

export interface UseFileListDragProps {
  panelId: "left" | "right";
  accessPath: string;
  currentPath: string;
  selectedItems: Set<string>;
  visibleRows: VisibleEntryRow[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const useFileListDrag = ({
  panelId,
  accessPath,
  currentPath,
  selectedItems,
  visibleRows,
  containerRef,
}: UseFileListDragProps) => {
  const { checkCopyConflicts, copyFiles, submitJob } = useFileSystem();
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const setDragInfo = useDragStore((s) => s.setDragInfo);
  const openDragCopyDialog = useDialogStore((s) => s.openDragCopyDialog);

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

  const dragCounterRef = useRef(0);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    paths: string[];
    dragging: boolean;
    nativeDragStarted: boolean;
  } | null>(null);

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

    await submitJob({
      kind: "copy",
      sourcePaths: paths,
      targetPath,
    });
    return true;
  };

  const handleDraggedMove = async (paths: string[], targetPath: string) => {
    const collapsedPaths = collapseNestedDirectoryPaths(paths);
    const conflicts = await checkCopyConflicts(collapsedPaths, targetPath);

    if (conflicts.length > 0) {
      showTransientToast("폴더를 이동하기 전에 이름 충돌을 해결해야 합니다.", {
        durationMs: 1800,
        tone: "warning",
      });
      return false;
    }

    await submitJob({
      kind: "move",
      sourcePaths: collapsedPaths,
      targetDir: targetPath,
    });
    showTransientToast("선택한 폴더를 이동 대기열에 추가했습니다.", {
      durationMs: 1800,
      tone: "success",
    });
    return true;
  };

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

  useEffect(() => {
    sharedPanelPaths[panelId] = { accessPath, currentPath };

    return () => {
      sharedPanelPaths[panelId] = { accessPath: "", currentPath: "" };
    };
  }, [accessPath, currentPath, panelId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      const activeDragInfo = useDragStore.getState().dragInfo;

      if ((state?.dragging || activeDragInfo) && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isOverContainer =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        if (isOverContainer && activeDragInfo?.sourcePanel !== panelId) {
          sharedDragState.hoveredPanel = panelId;
          sharedDragState.hoveredPanelPath = accessPath || currentPath;
        }

        const rowElement = findFileEntryElement(
          document.elementFromPoint(e.clientX, e.clientY)
        );
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
        const samePanelBackgroundDropTarget = resolveSamePanelBackgroundDropTarget({
          isOverContainer,
          rowPath,
          activeDragInfo,
          panelId,
          accessPath,
        });

        if (samePanelBackgroundDropTarget) {
          sharedDragState.dropTargetPath = samePanelBackgroundDropTarget;
          sharedDragState.isDropAllowed = true;
          sharedDragState.blockedReason = null;
          updateDropUiState({
            isPanelHovered: true,
            dropTargetPath: samePanelBackgroundDropTarget,
            isDropAllowed: true,
          });
        } else if (isOverContainer && canAcceptDrop && activeDragInfo) {
          const blockedReason = getBlockedDropReason(activeDragInfo, targetEntry!.path);
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
          if (
            activeDragInfo?.sourcePanel === panelId &&
            (sharedDragState.hoveredPanel === null || sharedDragState.hoveredPanel === panelId)
          ) {
            sharedDragState.dropTargetPath = null;
            sharedDragState.isDropAllowed = false;
            sharedDragState.blockedReason = null;
          } else if (sharedDragState.hoveredPanel === panelId) {
            sharedDragState.dropTargetPath = null;
            sharedDragState.isDropAllowed = false;
            sharedDragState.blockedReason = null;
          }

          if (!isOverContainer) {
            clearSharedDropTargetForPanel(panelId);
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

      if (!state.dragging) {
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
          const directoryPaths = state.paths.filter((path) => {
            const entry = visibleRows.find((row) => row.entry.path === path)?.entry;
            return entry?.kind === "directory";
          });
          state.dragging = true;
          setDragInfo({ paths: state.paths, directoryPaths, sourcePanel: panelId });
          setIsLocalDragActive(true);
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }
        return;
      }

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
            resetSharedDragState();
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

    const handleMouseUp = (event: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      if (state.nativeDragStarted) {
        dragStateRef.current = null;
        return;
      }

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (state.dragging) {
        const activeDragInfo = useDragStore.getState().dragInfo;
        const panelElement = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest("[data-panel-id]") as HTMLElement | null;
        const hoveredPanelFromPointer = getPanelIdFromElement(panelElement);
        const targetPanel = resolveMouseUpTargetPanel({
          sourcePanel: panelId,
          hoveredPanel: sharedDragState.hoveredPanel,
          hoveredPanelFromPointer,
        });
        const samePanelDropIntent = resolveSamePanelDropIntent({
          sourcePanel: panelId,
          targetPanel,
          activeDragInfo,
          dropTargetPath: sharedDragState.dropTargetPath,
          isDropAllowed: sharedDragState.isDropAllowed,
          blockedReason: sharedDragState.blockedReason,
        });

        if (samePanelDropIntent) {
          const {
            targetPath,
            isDropAllowed,
            blockedReason,
            isFolderOnlyMove,
          } = samePanelDropIntent;

          setDragInfo(null);
          resetSharedDragState();
          dragStateRef.current = null;
          setIsLocalDragActive(false);
          updateDropUiState({
            isPanelHovered: false,
            dropTargetPath: null,
            isDropAllowed: false,
          });

          if (!isDropAllowed) {
            showTransientToast(blockedReason ?? "여기로는 복사할 수 없습니다.", {
              durationMs: 1800,
              tone: "warning",
            });
            return;
          }

          const dragAction = isFolderOnlyMove
            ? handleDraggedMove(state.paths, targetPath)
            : handleDraggedCopy(state.paths, targetPath, panelId);

          void dragAction
            .catch((error) => {
              console.error("Failed to process dragged files:", error);
              showTransientToast(
                isFolderOnlyMove
                  ? "폴더를 이동하지 못했습니다."
                  : "파일을 복사하지 못했습니다.",
                { durationMs: 1800, tone: "error" }
              );
            });
          return;
        }

        if (targetPanel && targetPanel !== panelId) {
          const stateSnapshot = usePanelStore.getState();
          const destinationPanel =
            targetPanel === "left" ? stateSnapshot.leftPanel : stateSnapshot.rightPanel;
          const fallbackPanelPath = coalescePanelPath(
            sharedPanelPaths[targetPanel].accessPath,
            sharedPanelPaths[targetPanel].currentPath
          );
          const crossPanelDropIntent = resolveCrossPanelDropIntent({
            sourcePanel: panelId,
            targetPanel,
            activeDragInfo,
            dropTargetPath: sharedDragState.dropTargetPath,
            hoveredPanelPath: sharedDragState.hoveredPanelPath,
            fallbackPanelPath,
            destinationPanelPath: coalescePanelPath(
              destinationPanel.resolvedPath,
              destinationPanel.currentPath
            ),
            isDropAllowed: sharedDragState.isDropAllowed,
            blockedReason: sharedDragState.blockedReason,
          });

          if (crossPanelDropIntent) {
            if (crossPanelDropIntent.blockedReason) {
              showTransientToast(crossPanelDropIntent.blockedReason, {
                durationMs: 1800,
                tone: "warning",
              });
              return;
            }

            void handleDraggedCopy(
              state.paths,
              crossPanelDropIntent.targetPath,
              crossPanelDropIntent.targetPanel
            ).catch((error) => {
              console.error("Failed to copy dragged files:", error);
              showTransientToast("파일을 복사하지 못했습니다.", {
                durationMs: 1800,
                tone: "error",
              });
            });
          }
        }
      }

      setDragInfo(null);
      resetSharedDragState();
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
    accessPath,
    currentPath,
    openDragCopyDialog,
    panelId,
    setActivePanel,
    setDragInfo,
    submitJob,
    visibleRows,
    containerRef,
  ]);

  const handleMouseDown = (e: React.MouseEvent, entry: FileEntry) => {
    if (entry.name === "..") return;
    if (e.button !== 0) return;

    e.preventDefault();

    resetSharedDragState();

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

    const activeDragInfo = useDragStore.getState().dragInfo;

    if (activeDragInfo) {
      return;
    }

    if (e.dataTransfer.files.length > 0) {
      const paths = getExternalDropPaths(e.dataTransfer.files);
      if (paths.length > 0) {
        try {
          await copyFiles(paths, accessPath);
        } catch (error) {
          console.error("Failed to copy external files:", error);
        }
      }
    }
  };

  return {
    dropUiState,
    isLocalDragActive,
    handleMouseDown,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
