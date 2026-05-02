import React, { useCallback, useEffect, useRef, useState } from "react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { FileEntry } from "../../types/file";
import { usePanelStore } from "../../store/panelStore";
import { useDragStore } from "../../store/dragStore";
import { coalescePanelPath } from "../../utils/path";
import { showTransientToast } from "../../store/toastStore";
import {
  clearSharedDropTargetForPanel,
  resetSharedDragState,
  sharedDragState,
  sharedPanelPaths,
} from "./fileListDragSharedState";
import {
  getBlockedDropReason,
  getDraggedDirectoryPaths,
  getPanelIdFromElement,
  hasPointerMovedBeyondThreshold,
  resolveCrossPanelDropIntent,
  resolveMouseUpTargetPanel,
  resolveSamePanelDropIntent,
  resolveSamePanelBackgroundDropTarget,
} from "./fileListDragRules";
import {
  findVisibleEntryAtPointer,
  isPointerInsideElement,
  isPointerOutsideWindow,
} from "./fileListDragPointer";
import type { VisibleEntryRow } from "./fileListRows";
import { getDragIcon } from "./fileListDragIcon";
import { useFileListDragActions } from "./useFileListDragActions";
import { useExternalFileDrop } from "./useExternalFileDrop";
import {
  EMPTY_FILE_LIST_DROP_UI_STATE,
  useFileListDropUiState,
} from "./useFileListDropUiState";

const DRAG_THRESHOLD_PX = 6;

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
  const setDragInfo = useDragStore((s) => s.setDragInfo);
  const { handleDraggedCopy, handleDraggedMove } = useFileListDragActions(panelId);
  const { dropUiState, updateDropUiState } = useFileListDropUiState();
  const [isLocalDragActive, setIsLocalDragActive] = useState(false);

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    paths: string[];
    dragging: boolean;
    nativeDragStarted: boolean;
  } | null>(null);

  const resetDragInteraction = useCallback(() => {
    setDragInfo(null);
    resetSharedDragState();
    dragStateRef.current = null;
    setIsLocalDragActive(false);
    updateDropUiState(EMPTY_FILE_LIST_DROP_UI_STATE);
  }, [setDragInfo, updateDropUiState]);

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
      const pointer = { clientX: e.clientX, clientY: e.clientY };

      if ((state?.dragging || activeDragInfo) && containerRef.current) {
        const container = containerRef.current;
        const isOverContainer = isPointerInsideElement(pointer, container);

        if (isOverContainer && activeDragInfo?.sourcePanel !== panelId) {
          sharedDragState.hoveredPanel = panelId;
          sharedDragState.hoveredPanelPath = accessPath || currentPath;
        }

        const { rowPath, targetEntry } = findVisibleEntryAtPointer(
          pointer,
          container,
          visibleRows
        );
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
        if (
          hasPointerMovedBeyondThreshold({
            startX: state.startX,
            startY: state.startY,
            currentX: pointer.clientX,
            currentY: pointer.clientY,
            thresholdPx: DRAG_THRESHOLD_PX,
          })
        ) {
          const directoryPaths = getDraggedDirectoryPaths(state.paths, visibleRows);
          state.dragging = true;
          setDragInfo({ paths: state.paths, directoryPaths, sourcePanel: panelId });
          setIsLocalDragActive(true);
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }
        return;
      }

      if (isPointerOutsideWindow(pointer)) {
        state.nativeDragStarted = true;
        document.body.style.cursor = "";

        startDrag({ item: state.paths, icon: getDragIcon() })
          .then(() => {
            resetDragInteraction();
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

          resetDragInteraction();

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

      resetDragInteraction();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    accessPath,
    currentPath,
    handleDraggedCopy,
    handleDraggedMove,
    panelId,
    resetDragInteraction,
    setDragInfo,
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

  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useExternalFileDrop({
      accessPath,
      panelId,
      handleDraggedCopy,
    });

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
