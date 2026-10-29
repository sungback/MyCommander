import type { DragInfo } from "../../../store/dragStore";
import type { PanelId } from "../../../types/file";
import { findVisibleEntryAtPointer, isPointerInsideElement } from "./fileListDragPointer";
import {
  getBlockedDropReason,
  resolveSamePanelBackgroundDropTarget,
} from "./fileListDragRules";
import {
  clearSharedDropTargetForPanel,
  sharedDragState,
} from "./fileListDragSharedState";
import type { VisibleEntryRow } from "../fileListRows";
import type { FileListDropUiState } from "./useFileListDropUiState";

interface PointerPosition {
  clientX: number;
  clientY: number;
}

interface UpdateFileListDragHoverArgs {
  pointer: PointerPosition;
  container: HTMLElement;
  visibleRows: VisibleEntryRow[];
  activeDragInfo: DragInfo | null;
  panelId: PanelId;
  accessPath: string;
  currentPath: string;
  updateDropUiState: (nextState: FileListDropUiState) => void;
}

export const updateFileListDragHover = ({
  pointer,
  container,
  visibleRows,
  activeDragInfo,
  panelId,
  accessPath,
  currentPath,
  updateDropUiState,
}: UpdateFileListDragHoverArgs) => {
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
    return;
  }

  if (isOverContainer && canAcceptDrop && activeDragInfo && targetEntry) {
    const blockedReason = getBlockedDropReason(activeDragInfo, targetEntry.path);
    const isDropAllowed = blockedReason === null;

    sharedDragState.dropTargetPath = targetEntry.path;
    sharedDragState.isDropAllowed = isDropAllowed;
    sharedDragState.blockedReason = blockedReason;
    updateDropUiState({
      isPanelHovered: true,
      dropTargetPath: targetEntry.path,
      isDropAllowed,
    });
    return;
  }

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
    return;
  }

  updateDropUiState({
    isPanelHovered: true,
    dropTargetPath: null,
    isDropAllowed: false,
  });
};
