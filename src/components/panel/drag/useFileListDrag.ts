import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileEntry } from "../../../types/file";
import { usePanelStore } from "../../../store/panelStore";
import { useDragStore } from "../../../store/dragStore";
import { coalescePanelPath } from "../../../utils/path";
import {
  resetSharedDragState,
  sharedDragState,
  sharedPanelPaths,
} from "./fileListDragSharedState";
import {
  getPanelIdFromElement,
  resolveCrossPanelDropIntent,
  resolveMouseUpTargetPanel,
  resolveSamePanelDropIntent,
} from "./fileListDragRules";
import type { VisibleEntryRow } from "../fileListRows";
import { useFileListDragActions } from "./useFileListDragActions";
import { useExternalFileDrop } from "./useExternalFileDrop";
import { updateFileListDragHover } from "./fileListDragHover";
import {
  EMPTY_FILE_LIST_DROP_UI_STATE,
  useFileListDropUiState,
} from "./useFileListDropUiState";
import {
  runCrossPanelDropAction,
  runSamePanelDropAction,
} from "./fileListDragDropActions";
import {
  resetDocumentDragStyles,
  startLocalDragAfterThreshold,
  startNativeDragOutsideWindow,
  type FileListDragInteractionState,
} from "./fileListDragInteraction";

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

  const dragStateRef = useRef<FileListDragInteractionState | null>(null);

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
        updateFileListDragHover({
          pointer,
          container: containerRef.current,
          visibleRows,
          activeDragInfo,
          panelId,
          accessPath,
          currentPath,
          updateDropUiState,
        });
      }

      if (!state || state.nativeDragStarted) return;

      if (!state.dragging) {
        startLocalDragAfterThreshold({
          panelId,
          pointer,
          selectedState: state,
          setDragInfo,
          setIsLocalDragActive,
          thresholdPx: DRAG_THRESHOLD_PX,
          visibleRows,
        });
        return;
      }

      startNativeDragOutsideWindow({
        pointer,
        resetDragInteraction,
        selectedState: state,
      });
    };

    const handleMouseUp = (event: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      if (state.nativeDragStarted) {
        dragStateRef.current = null;
        return;
      }

      resetDocumentDragStyles();

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
          resetDragInteraction();
          runSamePanelDropAction({
            paths: state.paths,
            panelId,
            intent: samePanelDropIntent,
            handleDraggedCopy,
            handleDraggedMove,
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
            const result = runCrossPanelDropAction({
              paths: state.paths,
              intent: crossPanelDropIntent,
              handleDraggedCopy,
            });

            if (result === "blocked") {
              return;
            }
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
