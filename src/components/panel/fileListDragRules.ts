import { DragInfo } from "../../store/dragStore";
import { arePathsEquivalent, getPathDirectoryName, isSameOrNestedPath } from "../../utils/path";
import { PanelId } from "../../types/file";

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

  if (activeDragInfo.paths.includes(targetPath)) {
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
