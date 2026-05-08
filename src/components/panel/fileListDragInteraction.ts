import { startDrag } from "@crabnebula/tauri-plugin-drag";
import type { PanelId } from "../../types/file";
import { getDragIcon } from "./fileListDragIcon";
import { isPointerOutsideWindow } from "./fileListDragPointer";
import {
  getDraggedDirectoryPaths,
  hasPointerMovedBeyondThreshold,
} from "./fileListDragRules";
import type { VisibleEntryRow } from "./fileListRows";

export interface FileListDragInteractionState {
  startX: number;
  startY: number;
  paths: string[];
  dragging: boolean;
  nativeDragStarted: boolean;
}

interface DragPointer {
  clientX: number;
  clientY: number;
}

interface StartLocalDragArgs {
  panelId: PanelId;
  pointer: DragPointer;
  selectedState: FileListDragInteractionState;
  setDragInfo: (dragInfo: {
    paths: string[];
    directoryPaths: string[];
    sourcePanel: PanelId;
  }) => void;
  setIsLocalDragActive: (isActive: boolean) => void;
  thresholdPx: number;
  visibleRows: VisibleEntryRow[];
}

export const startLocalDragAfterThreshold = ({
  panelId,
  pointer,
  selectedState,
  setDragInfo,
  setIsLocalDragActive,
  thresholdPx,
  visibleRows,
}: StartLocalDragArgs) => {
  if (selectedState.dragging) {
    return false;
  }

  if (
    !hasPointerMovedBeyondThreshold({
      startX: selectedState.startX,
      startY: selectedState.startY,
      currentX: pointer.clientX,
      currentY: pointer.clientY,
      thresholdPx,
    })
  ) {
    return false;
  }

  const directoryPaths = getDraggedDirectoryPaths(selectedState.paths, visibleRows);
  selectedState.dragging = true;
  setDragInfo({
    paths: selectedState.paths,
    directoryPaths,
    sourcePanel: panelId,
  });
  setIsLocalDragActive(true);
  document.body.style.cursor = "grabbing";
  document.body.style.userSelect = "none";
  return true;
};

interface StartNativeDragArgs {
  pointer: DragPointer;
  resetDragInteraction: () => void;
  selectedState: FileListDragInteractionState;
}

export const startNativeDragOutsideWindow = ({
  pointer,
  resetDragInteraction,
  selectedState,
}: StartNativeDragArgs) => {
  if (!isPointerOutsideWindow(pointer)) {
    return false;
  }

  selectedState.nativeDragStarted = true;
  document.body.style.cursor = "";

  startDrag({ item: selectedState.paths, icon: getDragIcon() })
    .then(() => {
      resetDragInteraction();
    })
    .catch(console.error);

  return true;
};

export const resetDocumentDragStyles = () => {
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
};
