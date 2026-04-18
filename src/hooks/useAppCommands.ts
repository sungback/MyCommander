import { useDialogStore } from "../store/dialogStore";
import { usePanelStore } from "../store/panelStore";
import { useUiStore } from "../store/uiStore";
import { writeClipboardText } from "../utils/clipboard";
import { arePathsEquivalent } from "../utils/path";
import { getErrorMessage, useFileSystem } from "./useFileSystem";
import { ClipboardState } from "../store/panelStore";
import { PanelState } from "../types/file";

export const isMacPlatform = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.navigator.platform.toUpperCase().includes("MAC");
};

const getPrimaryTargetPath = () => {
  const state = usePanelStore.getState();
  const panel = state.activePanel === "left" ? state.leftPanel : state.rightPanel;
  const selectedPath = Array.from(panel.selectedItems)[0];
  if (selectedPath) {
    return selectedPath;
  }

  const cursorEntry = panel.files[panel.cursorIndex];
  if (!cursorEntry || cursorEntry.name === "..") {
    return null;
  }

  return cursorEntry.path;
};

let clearStatusMessageTimeoutId: number | undefined;

const getPanelAccessPath = (panel: PanelState) => panel.resolvedPath ?? panel.currentPath;

export const showTransientStatusMessage = (message: string, durationMs: number = 1400) => {
  const { setStatusMessage } = useUiStore.getState();
  if (clearStatusMessageTimeoutId !== undefined) {
    window.clearTimeout(clearStatusMessageTimeoutId);
  }

  setStatusMessage(message);
  clearStatusMessageTimeoutId = window.setTimeout(() => {
    useUiStore.getState().setStatusMessage(null);
    clearStatusMessageTimeoutId = undefined;
  }, durationMs);
};

export function useAppCommands() {
  const setOpenDialog = useDialogStore((s) => s.setOpenDialog);
  const openPasteDialog = useDialogStore((s) => s.openPasteDialog);
  const openDialog = useDialogStore((s) => s.openDialog);
  const fs = useFileSystem();

  const openPreview = () => setOpenDialog("preview");
  const openCopy = () => setOpenDialog("copy");
  const openMove = () => setOpenDialog("move");
  const openMkdir = () => setOpenDialog("mkdir");
  const openNewFile = () => setOpenDialog("newfile");
  const openDelete = () => setOpenDialog("delete");
  const openSearch = () => setOpenDialog("search");
  const openSync = () => setOpenDialog("sync");
  const swapPanels = () => usePanelStore.getState().swapPanels();

  const openEditor = async () => {
    const path = getPrimaryTargetPath();
    if (!path) {
      return;
    }

    try {
      await fs.openInEditor(path);
    } catch (error) {
      console.error("Failed to open editor:", error);
      window.alert(getErrorMessage(error, "Failed to open the editor."));
    }
  };

  const closeApp = async () => {
    try {
      await fs.quitApp();
    } catch (error) {
      console.error("Failed to quit app:", error);
    }
  };

  const syncOtherPanelToCurrentPath = (sourcePanelId?: "left" | "right") => {
    const state = usePanelStore.getState();
    const resolvedSourcePanelId = sourcePanelId ?? state.activePanel;
    const targetPanelId = resolvedSourcePanelId === "left" ? "right" : "left";
    const sourcePanel =
      resolvedSourcePanelId === "left" ? state.leftPanel : state.rightPanel;
    const targetPanel = targetPanelId === "left" ? state.leftPanel : state.rightPanel;

    if (arePathsEquivalent(getPanelAccessPath(sourcePanel), getPanelAccessPath(targetPanel))) {
      return;
    }

    state.setPath(targetPanelId, sourcePanel.currentPath);
  };

  const copyCurrentPath = async (panelId?: "left" | "right") => {
    const state = usePanelStore.getState();
    const resolvedPanelId = panelId ?? state.activePanel;
    const panel = resolvedPanelId === "left" ? state.leftPanel : state.rightPanel;

    try {
      await writeClipboardText(panel.currentPath);
      showTransientStatusMessage("Path copied");
    } catch (error) {
      console.error("Failed to copy current path:", error);
      showTransientStatusMessage("Clipboard unavailable");
    }
  };

  const getActiveSelectedPaths = (): string[] => {
    const state = usePanelStore.getState();
    const panelId = state.activePanel;
    const panel = panelId === "left" ? state.leftPanel : state.rightPanel;
    const selected = Array.from(panel.selectedItems);
    if (selected.length > 0) return selected;
    const cursor = panel.files[panel.cursorIndex];
    if (cursor && cursor.name !== "..") return [cursor.path];
    return [];
  };

  const copyToClipboard = async () => {
    const paths = getActiveSelectedPaths();
    if (paths.length === 0) return;

    const state = usePanelStore.getState();
    const clipState: ClipboardState = {
      paths,
      operation: "copy",
      sourcePanel: state.activePanel,
    };
    state.setClipboard(clipState);

    try {
      await fs.writeFilesToPasteboard(paths, "copy");
    } catch (e) {
      console.error("Failed to write to pasteboard:", e);
    }

    showTransientStatusMessage(`${paths.length}개 항목 복사됨`);
  };

  const cutToClipboard = async () => {
    const paths = getActiveSelectedPaths();
    if (paths.length === 0) return;

    const state = usePanelStore.getState();
    const clipState: ClipboardState = {
      paths,
      operation: "cut",
      sourcePanel: state.activePanel,
    };
    state.setClipboard(clipState);

    try {
      await fs.writeFilesToPasteboard(paths, "cut");
    } catch (e) {
      console.error("Failed to write to pasteboard:", e);
    }

    showTransientStatusMessage(`${paths.length}개 항목 잘라내기됨`);
  };

  const pasteFromClipboard = () => {
    const state = usePanelStore.getState();
    const clipboard = state.clipboard;
    if (!clipboard) return;

    const activePanel = state.activePanel;
    const panel = activePanel === "left" ? state.leftPanel : state.rightPanel;

    // 같은 폴더로 cut 이동은 의미 없음
    if (clipboard.operation === "cut") {
      const sourcePaths = clipboard.paths;
      const sameFolder = sourcePaths.every((p) => {
        const parent = p.substring(0, p.lastIndexOf("/")) || p.substring(0, p.lastIndexOf("\\"));
        return parent === getPanelAccessPath(panel);
      });
      if (sameFolder) {
        showTransientStatusMessage("이미 같은 위치에 있습니다");
        return;
      }
    }

    if (clipboard.operation === "copy") {
      openPasteDialog("copy");
    } else {
      openPasteDialog("move");
    }
  };

  const runCommandInCurrentPath = async (command: string, panelId?: "left" | "right") => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      showTransientStatusMessage("Command is empty");
      return;
    }

    const state = usePanelStore.getState();
    const resolvedPanelId = panelId ?? state.activePanel;
    const panel = resolvedPanelId === "left" ? state.leftPanel : state.rightPanel;

    try {
      await fs.runShellCommand(getPanelAccessPath(panel), trimmedCommand);
      showTransientStatusMessage("Command started");
    } catch (error) {
      console.error("Failed to run command:", error);
      window.alert(getErrorMessage(error, "Failed to run the command."));
    }
  };

  return {
    openDialog,
    openPreview,
    openEditor,
    openCopy,
    openMove,
    openMkdir,
    openNewFile,
    openDelete,
    openSearch,
    openSync,
    swapPanels,
    closeApp,
    syncOtherPanelToCurrentPath,
    copyCurrentPath,
    runCommandInCurrentPath,
    copyToClipboard,
    cutToClipboard,
    pasteFromClipboard,
  };
}
