import { useCallback } from "react";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { showTransientToast } from "../../store/toastStore";
import type { PanelId } from "../../types/file";
import { collapseNestedDirectoryPaths } from "./fileListDragRules";

export const useFileListDragActions = (panelId: PanelId) => {
  const { checkCopyConflicts, submitJob } = useFileSystem();
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const openDragCopyDialog = useDialogStore((s) => s.openDragCopyDialog);

  const handleDraggedCopy = useCallback(
    async (paths: string[], targetPath: string, targetPanelId: PanelId) => {
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
    },
    [checkCopyConflicts, openDragCopyDialog, panelId, setActivePanel, submitJob]
  );

  const handleDraggedMove = useCallback(
    async (paths: string[], targetPath: string) => {
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
    },
    [checkCopyConflicts, submitJob]
  );

  return {
    handleDraggedCopy,
    handleDraggedMove,
  };
};
