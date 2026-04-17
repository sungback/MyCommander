import { useEffect } from "react";
import { useDialogStore } from "../store/dialogStore";
import { usePanelStore } from "../store/panelStore";
import { useFavoriteStore } from "../store/favoriteStore";
import { useFileSystem } from "./useFileSystem";
import { PanelState } from "../types/file";
import { isMacPlatform, showTransientStatusMessage, useAppCommands } from "./useAppCommands";

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
  const setPanelViewMode = usePanelStore((s) => s.setPanelViewMode);
  const goBack = usePanelStore((s) => s.goBack);
  const goForward = usePanelStore((s) => s.goForward);

  useEffect(() => {
    const isMac = isMacPlatform();

    const calculatePanelDirectories = async (
      panelId: "left" | "right",
      panel: PanelState
    ) => {
      const directories = panel.files
        .filter((entry) => entry.kind === "directory" && entry.name !== "..");

      const queue = [...directories];
      const workers = Array.from({
        length: Math.min(4, queue.length),
      }, async () => {
        while (queue.length > 0) {
          const entry = queue.shift();
          if (!entry) {
            return;
          }

          try {
            const size = await getDirSize(entry.path);
            updateEntrySize(panelId, entry.path, size);
          } catch (error) {
            console.error(`Failed to calculate dir size for ${entry.path}:`, error);
          }
        }
      });

      await Promise.all(workers);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const hasCommandModifier = e.ctrlKey || e.metaKey;
      const isCloseShortcut =
        (isMac && e.metaKey && e.code === "KeyQ") ||
        (!isMac && e.altKey && e.key === "F4");

      if (isCloseShortcut) {
        e.preventDefault();
        void closeApp();
        return;
      }

      // Don't intercept if a dialog is already open (except Escape)
      if (openDialog !== null) {
        if (e.key === "Escape") {
          e.preventDefault();
          useDialogStore.getState().closeDialog();
        }
        return;
      }

      // Escape: 클립보드 초기화
      if (e.key === "Escape") {
        const clipState = usePanelStore.getState().clipboard;
        if (clipState) {
          e.preventDefault();
          usePanelStore.getState().clearClipboard();
          showTransientStatusMessage("클립보드 초기화됨");
        }
        return;
      }

      switch (e.key) {
        case "F3":
          e.preventDefault();
          openPreview();
          break;
        case "F4":
          if (!e.altKey) {
            e.preventDefault();
            if (e.shiftKey) {
              openNewFile();
            } else {
              void openEditor();
            }
          }
          break;
        case "F5":
          e.preventDefault();
          openCopy();
          break;
        case "F6":
          e.preventDefault();
          openMove();
          break;

        case "F8":
        case "Delete":
          if (document.activeElement?.tagName !== "INPUT") {
             e.preventDefault();
             openDelete();
          }
          break;
        case "F7":
          if (e.altKey) {
            e.preventDefault();
            openSearch();
          } else {
            e.preventDefault();
            openMkdir();
          }
          break;
        case "F11":
          e.preventDefault();
          openSync();
          break;
        default:
          break;
      }

      if (hasCommandModifier && e.code === "KeyF") {
        e.preventDefault();
        openSearch();
        return;
      }

      if (hasCommandModifier && e.key === "F1") {
        e.preventDefault();
        const state = usePanelStore.getState();
        setPanelViewMode(state.activePanel, "brief");
        return;
      }

      if (hasCommandModifier && e.key === "F2") {
        e.preventDefault();
        const state = usePanelStore.getState();
        setPanelViewMode(state.activePanel, "detailed");
        return;
      }

      // Cmd+C: 복사 (INPUT 포커스 시 제외)
      if (hasCommandModifier && !e.shiftKey && e.code === "KeyC") {
        if (document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          void copyToClipboard();
        }
        return;
      }

      // Cmd+X: 잘라내기 (INPUT 포커스 시 제외)
      if (hasCommandModifier && !e.shiftKey && e.code === "KeyX") {
        if (document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          void cutToClipboard();
        }
        return;
      }

      // Cmd+V: 붙여넣기 (INPUT 포커스 시 제외)
      if (hasCommandModifier && !e.shiftKey && e.code === "KeyV") {
        if (document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          pasteFromClipboard();
        }
        return;
      }

      if (hasCommandModifier && e.shiftKey && e.code === "KeyC") {
        if (document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          void copyCurrentPath();
        }
        return;
      }

      if (hasCommandModifier && e.shiftKey && e.code === "KeyM") {
        e.preventDefault();
        syncOtherPanelToCurrentPath();
        return;
      }

      if (hasCommandModifier && !e.shiftKey && e.code === "KeyU") {
        e.preventDefault();
        swapPanels();
        return;
      }

      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        goBack(usePanelStore.getState().activePanel);
        return;
      }

      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        goForward(usePanelStore.getState().activePanel);
        return;
      }

      if (hasCommandModifier && !e.shiftKey && e.code === "KeyD") {
        if (document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          const state = usePanelStore.getState();
          const panel =
            state.activePanel === "left" ? state.leftPanel : state.rightPanel;
          useFavoriteStore.getState().addFavorite(panel.currentPath);
        }
        return;
      }

      if (hasCommandModifier && e.code === "KeyI") {
        const state = usePanelStore.getState();
        const activeId = state.activePanel;
        const panel = activeId === "left" ? state.leftPanel : state.rightPanel;
        const current = panel.files[panel.cursorIndex];

        if (current && current.name !== "..") {
          e.preventDefault();
          openInfoDialog({ panelId: activeId, path: current.path });
        }
      }

      if (hasCommandModifier && e.code === "KeyL") {
        e.preventDefault();
        const state = usePanelStore.getState();
        void Promise.all([
          calculatePanelDirectories("left", state.leftPanel),
          calculatePanelDirectories("right", state.rightPanel),
        ]);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    closeApp,
    getDirSize,
    goBack,
    goForward,
    openCopy,
    openDelete,
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
    copyCurrentPath,
    syncOtherPanelToCurrentPath,
    updateEntrySize,
    copyToClipboard,
    cutToClipboard,
    pasteFromClipboard,
  ]);
}
