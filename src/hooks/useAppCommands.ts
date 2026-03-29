import { useDialogStore } from "../store/dialogStore";
import { usePanelStore } from "../store/panelStore";
import { getErrorMessage, useFileSystem } from "./useFileSystem";

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

export function useAppCommands() {
  const setOpenDialog = useDialogStore((s) => s.setOpenDialog);
  const openDialog = useDialogStore((s) => s.openDialog);
  const fs = useFileSystem();

  const openPreview = () => setOpenDialog("preview");
  const openCopy = () => setOpenDialog("copy");
  const openMove = () => setOpenDialog("move");
  const openMkdir = () => setOpenDialog("mkdir");
  const openDelete = () => setOpenDialog("delete");
  const openSearch = () => setOpenDialog("search");

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

  return {
    openDialog,
    openPreview,
    openEditor,
    openCopy,
    openMove,
    openMkdir,
    openDelete,
    openSearch,
    closeApp,
  };
}
