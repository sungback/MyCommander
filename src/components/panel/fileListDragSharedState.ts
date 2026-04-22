import { PanelId } from "../../types/file";

export const sharedDragState = {
  hoveredPanel: null as PanelId | null,
  hoveredPanelPath: null as string | null,
  dropTargetPath: null as string | null,
  isDropAllowed: false,
  blockedReason: null as string | null,
};

export const sharedPanelPaths = {
  left: { accessPath: "", currentPath: "" },
  right: { accessPath: "", currentPath: "" },
};

export const resetSharedDragState = () => {
  sharedDragState.hoveredPanel = null;
  sharedDragState.hoveredPanelPath = null;
  sharedDragState.dropTargetPath = null;
  sharedDragState.isDropAllowed = false;
  sharedDragState.blockedReason = null;
};

export const clearSharedDropTargetForPanel = (targetPanel: PanelId) => {
  if (sharedDragState.hoveredPanel === targetPanel) {
    resetSharedDragState();
  }
};
