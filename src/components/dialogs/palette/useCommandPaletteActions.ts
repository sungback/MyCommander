import { useMemo } from "react";
import { calculatePanelDirectorySizesWithToast } from "../../../hooks/directorySizeActions";
import { getErrorMessage, useFileSystem } from "../../../hooks/useFileSystem";
import { useClipboardStore } from "../../../store/clipboardStore";
import { type DialogTarget, useDialogStore } from "../../../store/dialogStore";
import { useJobStore } from "../../../store/jobStore";
import { useFileOperationUndoStore } from "../../../store/fileOperationUndoStore";
import {
  getUndoRefreshDirectories,
  submitZipSelectionJob,
  undoFileOperation,
} from "../../../features/fileOperationJobs";
import { refreshPanelsForDirectories } from "../../../store/panelRefresh";
import { usePanelStore } from "../../../store/panelStore";
import { showTransientToast } from "../../../store/toastStore";
import { writeClipboardText } from "../../../utils/clipboard";
import { getPathDirectoryName } from "../../../utils/path";
import {
  getPanelCommandPath,
  getPrimaryCommandTarget,
  getSelectedCommandPaths,
  type CommandTarget,
  type CommandPaletteActions,
} from "./commandPaletteActions";

const openPrimaryTargetDialog = (
  primaryTarget: CommandTarget | null,
  setActivePanel: (panelId: CommandTarget["panelId"]) => void,
  openDialog: (target: DialogTarget) => void
) => {
  if (!primaryTarget) {
    return;
  }

  setActivePanel(primaryTarget.panelId);
  openDialog({
    panelId: primaryTarget.panelId,
    path: primaryTarget.path,
    entry: primaryTarget.entry,
  });
};

export const useCommandPaletteActions = (): CommandPaletteActions => {
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const setOpenDialog = useDialogStore((state) => state.setOpenDialog);
  const openRenameDialog = useDialogStore((state) => state.openRenameDialog);
  const openInfoDialog = useDialogStore((state) => state.openInfoDialog);
  const openPreviewDialog = useDialogStore((state) => state.openPreviewDialog);
  const activePanelId = usePanelStore((state) => state.activePanel);
  const leftPanel = usePanelStore((state) => state.leftPanel);
  const rightPanel = usePanelStore((state) => state.rightPanel);
  const showHiddenFiles = usePanelStore((state) => state.showHiddenFiles);
  const setShowHiddenFiles = usePanelStore((state) => state.setShowHiddenFiles);
  const swapPanels = usePanelStore((state) => state.swapPanels);
  const setActivePanel = usePanelStore((state) => state.setActivePanel);
  const setPath = usePanelStore((state) => state.setPath);
  const refreshPanel = usePanelStore((state) => state.refreshPanel);
  const setEntrySizeStatus = usePanelStore((state) => state.setEntrySizeStatus);
  const updateEntrySize = usePanelStore((state) => state.updateEntrySize);
  const updateEntrySizeEstimate = usePanelStore(
    (state) => state.updateEntrySizeEstimate
  );
  const updateEntrySizeProgress = usePanelStore(
    (state) => state.updateEntrySizeProgress
  );
  const setClipboard = useClipboardStore((state) => state.setClipboard);
  const clipboard = useClipboardStore((state) => state.clipboard);
  const upsertJob = useJobStore((state) => state.upsertJob);
  const fs = useFileSystem();

  const activePanel = activePanelId === "left" ? leftPanel : rightPanel;
  const selectedPaths = useMemo(
    () => getSelectedCommandPaths(activePanel),
    [activePanel]
  );
  const primaryTarget = useMemo(
    () => getPrimaryCommandTarget(activePanel, activePanelId),
    [activePanel, activePanelId]
  );
  const activeAccessPath = getPanelCommandPath(activePanel);

  return useMemo<CommandPaletteActions>(
    () => ({
      calculateFolderSizes: async () => {
        closeDialog();
        await calculatePanelDirectorySizesWithToast({
          client: fs,
          panelId: activePanelId,
          panel: activePanel,
          setEntrySizeStatus,
          updateEntrySize,
          updateEntrySizeEstimate,
          updateEntrySizeProgress,
        });
      },
      closeApp: async () => {
        closeDialog();
        try {
          await fs.quitApp();
        } catch (error) {
          console.error("Failed to quit app:", error);
        }
      },
      copyCurrentPath: async () => {
        closeDialog();
        try {
          await writeClipboardText(activePanel.currentPath);
          showTransientToast("경로를 복사했습니다.");
        } catch (error) {
          console.error("Failed to copy current path:", error);
          showTransientToast("클립보드를 사용할 수 없습니다.", { tone: "error" });
        }
      },
      copyToClipboard: async () => {
        if (selectedPaths.length === 0) {
          return;
        }
        closeDialog();
        setClipboard({
          paths: selectedPaths,
          operation: "copy",
          sourcePanel: activePanelId,
        });
        try {
          await fs.writeFilesToPasteboard(selectedPaths, "copy");
        } catch (error) {
          console.error("Failed to write copy paths to pasteboard:", error);
        }
        showTransientToast(`${selectedPaths.length}개 항목 복사됨`);
      },
      createZipFromSelection: async () => {
        if (selectedPaths.length === 0) {
          return;
        }
        closeDialog();
        try {
          const job = await submitZipSelectionJob(fs, selectedPaths, activePanel);
          upsertJob(job);
          setOpenDialog("progress");
          showTransientToast("압축 작업이 대기열에 추가되었습니다.");
        } catch (error) {
          console.error("Failed to create ZIP from selection:", error);
          showTransientToast("압축 작업을 시작하지 못했습니다.", { tone: "error" });
        }
      },
      cutToClipboard: async () => {
        if (selectedPaths.length === 0) {
          return;
        }
        closeDialog();
        setClipboard({
          paths: selectedPaths,
          operation: "cut",
          sourcePanel: activePanelId,
        });
        try {
          await fs.writeFilesToPasteboard(selectedPaths, "cut");
        } catch (error) {
          console.error("Failed to write cut paths to pasteboard:", error);
        }
        showTransientToast(`${selectedPaths.length}개 항목 잘라내기됨`);
      },
      extractZip: async () => {
        if (!primaryTarget) {
          return;
        }
        closeDialog();
        try {
          await fs.extractZip(primaryTarget.path);
          refreshPanelsForDirectories([getPathDirectoryName(primaryTarget.path)]);
          showTransientToast("압축을 해제했습니다.");
        } catch (error) {
          console.error("Failed to extract ZIP:", error);
          showTransientToast("압축을 해제하지 못했습니다.", { tone: "error" });
        }
      },
      openCopy: () => setOpenDialog("copy"),
      openDelete: () => setOpenDialog("delete"),
      openEditor: async () => {
        if (!primaryTarget) {
          return;
        }
        closeDialog();
        try {
          await fs.openInEditor(primaryTarget.path);
        } catch (error) {
          console.error("Failed to open editor:", error);
          window.alert(getErrorMessage(error, "Failed to open the editor."));
        }
      },
      openInfo: () => {
        openPrimaryTargetDialog(primaryTarget, setActivePanel, openInfoDialog);
      },
      openJobCenter: () => setOpenDialog("jobcenter"),
      openLocation: (path: string) => {
        closeDialog();
        setPath(activePanelId, path);
      },
      openMkdir: () => setOpenDialog("mkdir"),
      openMove: () => setOpenDialog("move"),
      openNewFile: () => setOpenDialog("newfile"),
      openPreview: () => {
        openPrimaryTargetDialog(primaryTarget, setActivePanel, openPreviewDialog);
      },
      openRename: () => {
        openPrimaryTargetDialog(primaryTarget, setActivePanel, openRenameDialog);
      },
      openSearch: () => setOpenDialog("search"),
      openSettings: () => setOpenDialog("settings"),
      openSync: () => setOpenDialog("sync"),
      openTerminal: async () => {
        closeDialog();
        try {
          await fs.openInTerminal(activeAccessPath);
        } catch (error) {
          console.error("Failed to open terminal:", error);
          showTransientToast("터미널을 열 수 없습니다.", { tone: "error" });
        }
      },
      pasteFromClipboard: () => {
        if (!clipboard) {
          closeDialog();
          showTransientToast("붙여넣을 항목이 없습니다.", { tone: "warning" });
          return;
        }
        setOpenDialog(clipboard.operation === "copy" ? "copy" : "move");
      },
      swapPanels: () => {
        closeDialog();
        swapPanels();
      },
      syncOtherPanel: () => {
        closeDialog();
        const state = usePanelStore.getState();
        const targetPanelId = activePanelId === "left" ? "right" : "left";
        state.setPath(targetPanelId, activePanel.currentPath);
      },
      toggleHiddenFiles: () => {
        closeDialog();
        setShowHiddenFiles(!showHiddenFiles);
        refreshPanel(activePanelId);
        showTransientToast(
          showHiddenFiles ? "숨김 파일을 숨겼습니다." : "숨김 파일을 표시합니다."
        );
      },
      undoLastFileOperation: async () => {
        const operation = useFileOperationUndoStore.getState().lastOperation;
        if (!operation) {
          return;
        }

        closeDialog();
        const refreshDirectories = getUndoRefreshDirectories(operation);
        try {
          await undoFileOperation(fs, operation);
          refreshPanelsForDirectories(refreshDirectories);
          showTransientToast("마지막 파일 작업을 되돌렸습니다.");
        } catch (error) {
          console.error("Failed to undo last file operation:", error);
          refreshPanelsForDirectories(refreshDirectories);
          showTransientToast(
            getErrorMessage(error, "파일 작업을 되돌리지 못했습니다."),
            { tone: "error" }
          );
        }
      },
    }),
    [
      activeAccessPath,
      activePanel,
      activePanelId,
      clipboard,
      closeDialog,
      fs,
      openInfoDialog,
      openPreviewDialog,
      openRenameDialog,
      primaryTarget,
      refreshPanel,
      selectedPaths,
      setActivePanel,
      setClipboard,
      setOpenDialog,
      setPath,
      setEntrySizeStatus,
      setShowHiddenFiles,
      showHiddenFiles,
      swapPanels,
      upsertJob,
      updateEntrySize,
      updateEntrySizeEstimate,
      updateEntrySizeProgress,
    ]
  );
};
