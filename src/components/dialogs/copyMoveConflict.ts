import type { DragCopyRequest } from "../../store/dialogStore";

export const COPY_MOVE_MISSING_TARGET_MESSAGE =
  "복사할 파일 또는 대상 경로를 확인할 수 없습니다.";

export interface PendingCopy {
  isMove: boolean;
  allPaths: string[];
  targetPath: string;
}

interface ConflictAction {
  isMove: boolean;
  sourcePaths: string[];
  targetPath: string;
}

interface ResolveConflictActionArgs {
  pendingCopy: PendingCopy | null;
  dragCopyRequest: DragCopyRequest | null;
  dragCopyTargetPath: string;
}

export const getCopyMoveFailureMessage = (isMove: boolean) =>
  isMove
    ? "Failed to move selected items."
    : "Failed to copy selected items.";

export const resolveConflictAction = ({
  pendingCopy,
  dragCopyRequest,
  dragCopyTargetPath,
}: ResolveConflictActionArgs): ConflictAction | null => {
  const sourcePaths =
    pendingCopy?.allPaths && pendingCopy.allPaths.length > 0
      ? pendingCopy.allPaths
      : dragCopyRequest?.sourcePaths ?? [];
  const targetPath =
    pendingCopy?.targetPath?.trim().length
      ? pendingCopy.targetPath
      : dragCopyTargetPath;
  const isMove = pendingCopy?.isMove ?? false;

  if (sourcePaths.length === 0 || targetPath.trim().length === 0) {
    return null;
  }

  return {
    isMove,
    sourcePaths,
    targetPath,
  };
};

export const filterNonConflictingSourcePaths = (
  sourcePaths: string[],
  conflictFiles: string[]
) => {
  const conflicts = new Set(conflictFiles);
  return sourcePaths.filter((path) => {
    const baseName = path.split(/[\\/]/).pop() || "";
    return !conflicts.has(baseName);
  });
};
