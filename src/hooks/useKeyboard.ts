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
  const { cancelDirSizeScan, scanDirSize } = useFileSystem();
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const updateEntrySizeEstimate = usePanelStore((s) => s.updateEntrySizeEstimate);
  const updateEntrySizeProgress = usePanelStore((s) => s.updateEntrySizeProgress);
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
      cancelDirSizeScan,
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
      scanDirSize,
      setEntrySizeStatus,
      setPanelViewMode,
      swapPanels,
      syncOtherPanelToCurrentPath,
      updateEntrySize,
      updateEntrySizeEstimate,
      updateEntrySizeProgress,
    });

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    closeApp,
    cancelDirSizeScan,
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
    scanDirSize,
    updateEntrySizeEstimate,
    updateEntrySizeProgress,
  ]);
}
