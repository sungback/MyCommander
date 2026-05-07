import { DragInfo } from "../../store/dragStore";
import { arePathsEquivalent, getPathDirectoryName, isSameOrNestedPath } from "../../utils/path";
import { PanelId } from "../../types/file";
import type { VisibleEntryRow } from "./fileListRows";

export const collapseNestedDirectoryPaths = (paths: string[]) => {
  const collapsed: string[] = [];

  for (const path of paths) {
    if (collapsed.some((keptPath) => isSameOrNestedPath(keptPath, path))) {
      continue;
    }

    for (let index = collapsed.length - 1; index >= 0; index -= 1) {
      if (isSameOrNestedPath(path, collapsed[index])) {
        collapsed.splice(index, 1);
      }
    }

    collapsed.push(path);
  }

  return collapsed;
};

export const isSamePanelBackgroundNoOp = (paths: string[], targetPath: string) =>
  paths.length > 0 &&
  paths.every((path) => arePathsEquivalent(getPathDirectoryName(path), targetPath));

interface HasPointerMovedBeyondThresholdArgs {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  thresholdPx: number;
}

export const hasPointerMovedBeyondThreshold = ({
  startX,
  startY,
  currentX,
  currentY,
  thresholdPx,
}: HasPointerMovedBeyondThresholdArgs) => {
  const dx = currentX - startX;
  const dy = currentY - startY;

  return Math.sqrt(dx * dx + dy * dy) > thresholdPx;
};

export const getDraggedDirectoryPaths = (
  paths: string[],
  visibleRows: VisibleEntryRow[]
) =>
  paths.filter((path) => {
    const entry = visibleRows.find((row) => row.entry.path === path)?.entry;
    return entry?.kind === "directory";
  });

interface ResolveSamePanelBackgroundDropTargetArgs {
  isOverContainer: boolean;
  rowPath: string | null;
  activeDragInfo: DragInfo | null;
  panelId: PanelId;
  accessPath: string;
}

export const resolveSamePanelBackgroundDropTarget = ({
  isOverContainer,
  rowPath,
  activeDragInfo,
  panelId,
  accessPath,
}: ResolveSamePanelBackgroundDropTargetArgs) => {
  if (!isOverContainer) {
    return null;
  }

  if (rowPath) {
    return null;
  }

  if (activeDragInfo?.sourcePanel !== panelId) {
    return null;
  }

  if (isSamePanelBackgroundNoOp(activeDragInfo.paths, accessPath)) {
    return null;
  }

  return accessPath;
};

export const getBlockedDropReason = (
  activeDragInfo: DragInfo | null,
  targetPath: string
) => {
  if (!activeDragInfo) {
    return null;
  }

  if (activeDragInfo.paths.some((sourcePath) => arePathsEquivalent(sourcePath, targetPath))) {
    return "자기 자신에게는 복사할 수 없습니다.";
  }

  if (
    activeDragInfo.directoryPaths.some((sourceDir) =>
      isSameOrNestedPath(sourceDir, targetPath)
    )
  ) {
    return "폴더를 자기 자신 안이나 하위 폴더로 복사할 수 없습니다.";
  }

  return null;
};

export const getPanelIdFromElement = (element: Element | null): PanelId | null => {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const panelId = element.dataset.panelId;
  return panelId === "left" || panelId === "right" ? panelId : null;
};

interface ResolveMouseUpTargetPanelArgs {
  sourcePanel: PanelId;
  hoveredPanel: PanelId | null;
  hoveredPanelFromPointer: PanelId | null;
}

export const resolveMouseUpTargetPanel = ({
  sourcePanel,
  hoveredPanel,
  hoveredPanelFromPointer,
}: ResolveMouseUpTargetPanelArgs): PanelId | null =>
  hoveredPanel ??
  (hoveredPanelFromPointer && hoveredPanelFromPointer !== sourcePanel
    ? hoveredPanelFromPointer
    : null);

interface SamePanelDropIntent {
  targetPath: string;
  isDropAllowed: boolean;
  blockedReason: string | null;
  isFolderOnlyMove: boolean;
}

interface ResolveSamePanelDropIntentArgs {
  sourcePanel: PanelId;
  targetPanel: PanelId | null;
  activeDragInfo: DragInfo | null;
  dropTargetPath: string | null;
  isDropAllowed: boolean;
  blockedReason: string | null;
}

export const resolveSamePanelDropIntent = ({
  sourcePanel,
  targetPanel,
  activeDragInfo,
  dropTargetPath,
  isDropAllowed,
  blockedReason,
}: ResolveSamePanelDropIntentArgs): SamePanelDropIntent | null => {
  if (
    targetPanel !== null ||
    activeDragInfo?.sourcePanel !== sourcePanel ||
    !dropTargetPath
  ) {
    return null;
  }

  return {
    targetPath: dropTargetPath,
    isDropAllowed,
    blockedReason,
    isFolderOnlyMove:
      activeDragInfo.directoryPaths.length > 0 &&
      activeDragInfo.directoryPaths.length === activeDragInfo.paths.length,
  };
};

interface CrossPanelDropIntent {
  targetPanel: PanelId;
  targetPath: string;
  blockedReason: string | null;
}

interface ResolveCrossPanelDropIntentArgs {
  sourcePanel: PanelId;
  targetPanel: PanelId | null;
  activeDragInfo: DragInfo | null;
  dropTargetPath: string | null;
  hoveredPanelPath: string | null;
  fallbackPanelPath: string;
  destinationPanelPath: string;
  isDropAllowed: boolean;
  blockedReason: string | null;
}

export const resolveCrossPanelDropIntent = ({
  sourcePanel,
  targetPanel,
  activeDragInfo,
  dropTargetPath,
  hoveredPanelPath,
  fallbackPanelPath,
  destinationPanelPath,
  isDropAllowed,
  blockedReason,
}: ResolveCrossPanelDropIntentArgs): CrossPanelDropIntent | null => {
  if (!targetPanel || targetPanel === sourcePanel) {
    return null;
  }

  const targetPath =
    dropTargetPath ??
    hoveredPanelPath ??
    (fallbackPanelPath || destinationPanelPath);
  const resolvedBlockedReason = dropTargetPath
    ? isDropAllowed
      ? null
      : blockedReason ?? "여기로는 복사할 수 없습니다."
    : getBlockedDropReason(activeDragInfo, targetPath);

  return {
    targetPanel,
    targetPath,
    blockedReason: resolvedBlockedReason,
  };
};
