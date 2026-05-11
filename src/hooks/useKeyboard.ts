import { useEffect } from "react";
import { useDialogStore } from "../store/dialogStore";
import { usePanelStore } from "../store/panelStore";
import { useFileSystem } from "./useFileSystem";
import { isMacPlatform, useAppCommands } from "./useAppCommands";
import { createKeyboardHandler } from "./keyboardShortcuts";

export function useKeyboard() {
  const openInfoDialog = useDialogStore((s) => s.openInfoDialog);
  const {
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
    openCommandPalette,
    swapPanels,
    closeApp,
    syncOtherPanelToCurrentPath,
    copyCurrentPath,
    copyToClipboard,
    cutToClipboard,
    pasteFromClipboard,
  } = useAppCommands();
  const { getDirSize } = useFileSystem();
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const setEntrySizeStatus = usePanelStore((s) => s.setEntrySizeStatus);
  const setPanelViewMode = usePanelStore((s) => s.setPanelViewMode);
  const goBack = usePanelStore((s) => s.goBack);
  const goForward = usePanelStore((s) => s.goForward);

  useEffect(() => {
    const handleKeyDown = createKeyboardHandler({
      isMac: isMacPlatform(),
      closeApp,
      copyCurrentPath,
      copyToClipboard,
      cutToClipboard,
      getDirSize,
      goBack,
      goForward,
      openCopy,
      openDelete,
      openCommandPalette,
      openDialog,
      openEditor,
      openInfoDialog,
      openMkdir,
      openMove,
      openNewFile,
      openPreview,
      openSearch,
      openSync,
      pasteFromClipboard,
      setEntrySizeStatus,
      setPanelViewMode,
      swapPanels,
      syncOtherPanelToCurrentPath,
      updateEntrySize,
    });

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    closeApp,
    getDirSize,
    goBack,
    goForward,
    openCopy,
    openDelete,
    openCommandPalette,
    openDialog,
    openEditor,
    openInfoDialog,
    openMkdir,
    openMove,
    openNewFile,
    openPreview,
    openSearch,
    openSync,
    swapPanels,
    setPanelViewMode,
    setEntrySizeStatus,
    copyCurrentPath,
    syncOtherPanelToCurrentPath,
    updateEntrySize,
    copyToClipboard,
    cutToClipboard,
    pasteFromClipboard,
  ]);
}
