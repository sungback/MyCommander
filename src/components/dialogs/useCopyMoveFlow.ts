import { useEffect, useState } from "react";
import { ClipboardState } from "../../store/clipboardStore";
import { DialogType, DragCopyRequest } from "../../store/dialogStore";
import { useFileSystem, getErrorMessage } from "../../hooks/useFileSystem";
import { showTransientStatusMessage } from "../../hooks/useAppCommands";
import { PanelState } from "../../types/file";
import type { JobSubmission } from "../../types/job";
import { resolveTargetPath } from "./dialogTargetPath";

interface PendingCopy {
  isMove: boolean;
  allPaths: string[];
  targetPath: string;
}

interface UseCopyMoveFlowArgs {
  openDialog: DialogType;
  dragCopyRequest: DragCopyRequest | null;
  dragCopyTargetPath: string;
  isPasteMode: boolean;
  activePanel: PanelState;
  targetPanel: PanelState;
  clipboard: ClipboardState | null;
  clearClipboard: () => void;
  selectedPaths: string[];
  inputValue: string;
  fs: ReturnType<typeof useFileSystem>;
  setOpenDialog: (dialog: DialogType) => void;
  openDragCopyDialog: (request: DragCopyRequest) => void;
  closeDialog: () => void;
}

export const useCopyMoveFlow = ({
  openDialog,
  dragCopyRequest,
  dragCopyTargetPath,
  isPasteMode,
  activePanel,
  targetPanel,
  clipboard,
  clearClipboard,
  selectedPaths,
  inputValue,
  fs,
  setOpenDialog,
  openDragCopyDialog,
  closeDialog,
}: UseCopyMoveFlowArgs) => {
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictFiles, setConflictFiles] = useState<string[]>([]);
  const [pendingCopy, setPendingCopy] = useState<PendingCopy | null>(null);

  useEffect(() => {
    setOperationError(null);
    setIsSubmitting(false);
    setConflictFiles([]);
    setPendingCopy(null);
  }, [openDialog]);

  const clearConflictState = () => {
    setConflictFiles([]);
    setPendingCopy(null);
  };

  const executeCopyMove = async (
    isMove: boolean,
    paths: string[],
    targetPath: string,
    keepBoth: boolean = false,
    overwrite: boolean = false
  ) => {
    if (paths.length === 0 || targetPath.trim().length === 0) {
      throw new Error(
        isMove
          ? "No source files or target folder available for move."
          : "No source files or target folder available for copy."
      );
    }

    setOpenDialog("progress");
    try {
      if (isMove) {
        await fs.submitJob({
          kind: "move",
          sourcePaths: paths,
          targetDir: targetPath,
        });
      } else {
        const copyJob: JobSubmission = {
          kind: "copy",
          sourcePaths: paths,
          targetPath,
          keepBoth,
        };
        if (overwrite) {
          copyJob.overwrite = true;
        }
        await fs.submitJob(copyJob);
      }

      if (isPasteMode && clipboard?.operation === "cut") {
        clearClipboard();
      }
      if (isMove) {
        showTransientStatusMessage("이동 작업이 대기열에 추가되었습니다.");
      }
    } catch (error) {
      console.error(error);
      if (!isMove && dragCopyRequest) {
        openDragCopyDialog({
          ...dragCopyRequest,
          targetPath: dragCopyTargetPath,
        });
      } else {
        setOpenDialog(isMove ? "move" : "copy");
      }
      throw error;
    }
  };

  const handleCopyMove = async (isMove: boolean) => {
    if (!inputValue || selectedPaths.length === 0) return;

    try {
      setIsSubmitting(true);
      setOperationError(null);
      const targetPath = resolveTargetPath({
        inputValue,
        isPasteMode,
        activePanel,
        targetPanel,
        openDialog,
        dragCopyRequest,
        dragCopyTargetPath,
      });

      const conflicts = await fs.checkCopyConflicts(selectedPaths, targetPath);
      if (conflicts.length > 0) {
        if (isPasteMode && !isMove) {
          await executeCopyMove(false, selectedPaths, targetPath, true);
          return;
        }

        setConflictFiles(conflicts);
        setPendingCopy({ isMove, allPaths: selectedPaths, targetPath });
        setIsSubmitting(false);
        return;
      }

      await executeCopyMove(isMove, selectedPaths, targetPath);
    } catch (error) {
      console.error(error);
      setOperationError(
        getErrorMessage(
          error,
          isMove
            ? "Failed to move selected items."
            : "Failed to copy selected items."
        )
      );
      setIsSubmitting(false);
    }
  };

  const handleOverwriteAll = async () => {
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
      setOperationError("복사할 파일 또는 대상 경로를 확인할 수 없습니다.");
      return;
    }

    try {
      setIsSubmitting(true);
      await executeCopyMove(isMove, sourcePaths, targetPath, false, true);
    } catch (error) {
      console.error(error);
      setOperationError(
        getErrorMessage(
          error,
          isMove
            ? "Failed to move selected items."
            : "Failed to copy selected items."
        )
      );
    } finally {
      setIsSubmitting(false);
      clearConflictState();
    }
  };

  const handleSkipExisting = async () => {
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
      setOperationError("복사할 파일 또는 대상 경로를 확인할 수 없습니다.");
      return;
    }

    try {
      setIsSubmitting(true);
      const nonConflicting = sourcePaths.filter((path) => {
        const baseName = path.split(/[\\/]/).pop() || "";
        return !conflictFiles.includes(baseName);
      });
      if (nonConflicting.length > 0) {
        await executeCopyMove(isMove, nonConflicting, targetPath);
      } else {
        closeDialog();
      }
    } catch (error) {
      console.error(error);
      setOperationError(
        getErrorMessage(
          error,
          isMove
            ? "Failed to move selected items."
            : "Failed to copy selected items."
        )
      );
    } finally {
      setIsSubmitting(false);
      clearConflictState();
    }
  };

  return {
    operationError,
    setOperationError,
    isSubmitting,
    setIsSubmitting,
    conflictFiles,
    handleCopyMove,
    handleOverwriteAll,
    handleSkipExisting,
    clearConflictState,
  };
};
