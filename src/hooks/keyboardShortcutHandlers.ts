import { useClipboardStore } from "../store/clipboardStore";
import { useDialogStore, type DialogType } from "../store/dialogStore";
import { useFavoriteStore } from "../store/favoriteStore";
import { usePanelStore } from "../store/panelStore";
import type { DirectorySizeStatus, PanelId, ViewMode } from "../types/file";
import { calculateDirectorySizesForPanels } from "./directorySizeActions";
import type { DirectorySizeScanResult } from "./tauriCommands/fileCommands";
import { showTransientStatusMessage, type useAppCommands } from "./useAppCommands";

type AppCommands = ReturnType<typeof useAppCommands>;

export interface KeyboardHandlerDependencies
  extends Pick<
    AppCommands,
    | "closeApp"
    | "copyCurrentPath"
    | "copyToClipboard"
    | "cutToClipboard"
    | "openCopy"
    | "openDelete"
    | "openDialog"
    | "openCommandPalette"
    | "openEditor"
    | "openMkdir"
    | "openMove"
    | "openNewFile"
    | "openPreview"
    | "openSearch"
    | "openSync"
    | "pasteFromClipboard"
    | "swapPanels"
    | "syncOtherPanelToCurrentPath"
  > {
  cancelDirSizeScan: (scanId: string) => Promise<void>;
  isMac: boolean;
  goBack: (panelId: PanelId) => void;
  goForward: (panelId: PanelId) => void;
  openInfoDialog: (target: { panelId: PanelId; path: string }) => void;
  scanDirSize: (path: string, scanId: string) => Promise<DirectorySizeScanResult>;
  setPanelViewMode: (panelId: PanelId, viewMode: ViewMode) => void;
  setEntrySizeStatus: (
    panelId: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  updateEntrySize: (panelId: PanelId, path: string, size: number) => void;
  updateEntrySizeEstimate: (
    panelId: PanelId,
    path: string,
    size: number,
    status: Extract<DirectorySizeStatus, "estimated" | "partial">
  ) => void;
  updateEntrySizeProgress: (panelId: PanelId, path: string, size: number) => void;
}

const isInputFocused = () => document.activeElement?.tagName === "INPUT";

const getActivePanelSnapshot = () => {
  const state = usePanelStore.getState();
  const activePanel = state.activePanel;
  const panel = activePanel === "left" ? state.leftPanel : state.rightPanel;
  return { activePanel, panel, state };
};

export const closeOpenDialog = (event: KeyboardEvent, openDialog: DialogType) => {
  if (openDialog === null) {
    return false;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    useDialogStore.getState().closeDialog();
  }

  return true;
};

export const clearClipboardOnEscape = (event: KeyboardEvent) => {
  if (event.key !== "Escape") {
    return false;
  }

  const clipState = useClipboardStore.getState().clipboard;
  if (!clipState) {
    return true;
  }

  event.preventDefault();
  useClipboardStore.getState().clearClipboard();
  showTransientStatusMessage("클립보드 초기화됨");
  return true;
};

export const handleFunctionShortcut = (
  event: KeyboardEvent,
  commands: Pick<
    KeyboardHandlerDependencies,
    | "openCopy"
    | "openDelete"
    | "openEditor"
    | "openMkdir"
    | "openMove"
    | "openNewFile"
    | "openPreview"
    | "openSearch"
    | "openSync"
  >
) => {
  switch (event.key) {
    case "F3":
      event.preventDefault();
      commands.openPreview();
      return true;
    case "F4":
      if (!event.altKey) {
        event.preventDefault();
        if (event.shiftKey) {
          commands.openNewFile();
        } else {
          void commands.openEditor();
        }
        return true;
      }
      return false;
    case "F5":
      event.preventDefault();
      commands.openCopy();
      return true;
    case "F6":
      event.preventDefault();
      commands.openMove();
      return true;
    case "F7":
      event.preventDefault();
      if (event.altKey) {
        commands.openSearch();
      } else {
        commands.openMkdir();
      }
      return true;
    case "F8":
    case "Delete":
      if (!isInputFocused()) {
        event.preventDefault();
        commands.openDelete();
      }
      return true;
    case "F11":
      event.preventDefault();
      commands.openSync();
      return true;
    default:
      return false;
  }
};

export const handleModifiedShortcut = (
  event: KeyboardEvent,
  deps: KeyboardHandlerDependencies
) => {
  const hasCommandModifier = event.ctrlKey || event.metaKey;

  if (hasCommandModifier && event.code === "KeyF") {
    event.preventDefault();
    deps.openSearch();
    return true;
  }

  if (hasCommandModifier && event.shiftKey && event.code === "KeyP") {
    event.preventDefault();
    deps.openCommandPalette();
    return true;
  }

  if (hasCommandModifier && event.key === "F1") {
    event.preventDefault();
    const state = usePanelStore.getState();
    deps.setPanelViewMode(state.activePanel, "brief");
    return true;
  }

  if (hasCommandModifier && event.key === "F2") {
    event.preventDefault();
    const state = usePanelStore.getState();
    deps.setPanelViewMode(state.activePanel, "detailed");
    return true;
  }

  if (hasCommandModifier && !event.shiftKey && event.code === "KeyC") {
    if (!isInputFocused()) {
      event.preventDefault();
      void deps.copyToClipboard();
    }
    return true;
  }

  if (hasCommandModifier && !event.shiftKey && event.code === "KeyX") {
    if (!isInputFocused()) {
      event.preventDefault();
      void deps.cutToClipboard();
    }
    return true;
  }

  if (hasCommandModifier && !event.shiftKey && event.code === "KeyV") {
    if (!isInputFocused()) {
      event.preventDefault();
      deps.pasteFromClipboard();
    }
    return true;
  }

  if (hasCommandModifier && event.shiftKey && event.code === "KeyC") {
    if (!isInputFocused()) {
      event.preventDefault();
      void deps.copyCurrentPath();
    }
    return true;
  }

  if (hasCommandModifier && event.shiftKey && event.code === "KeyM") {
    event.preventDefault();
    deps.syncOtherPanelToCurrentPath();
    return true;
  }

  if (hasCommandModifier && !event.shiftKey && event.code === "KeyU") {
    event.preventDefault();
    deps.swapPanels();
    return true;
  }

  if (hasCommandModifier && !event.shiftKey && event.code === "KeyD") {
    if (!isInputFocused()) {
      event.preventDefault();
      const { panel } = getActivePanelSnapshot();
      useFavoriteStore.getState().addFavorite(panel.currentPath);
    }
    return true;
  }

  if (hasCommandModifier && event.code === "KeyI") {
    const { activePanel, panel } = getActivePanelSnapshot();
    const current = panel.files[panel.cursorIndex];

    if (current && current.name !== "..") {
      event.preventDefault();
      deps.openInfoDialog({ panelId: activePanel, path: current.path });
    }
    return true;
  }

  if (hasCommandModifier && event.code === "KeyL") {
    event.preventDefault();
    const state = usePanelStore.getState();
    void calculateDirectorySizesForPanels({
      client: deps,
      panels: [
        { panelId: "left", panel: state.leftPanel },
        { panelId: "right", panel: state.rightPanel },
      ],
      setEntrySizeStatus: deps.setEntrySizeStatus,
      updateEntrySize: deps.updateEntrySize,
      updateEntrySizeEstimate: deps.updateEntrySizeEstimate,
      updateEntrySizeProgress: deps.updateEntrySizeProgress,
    });
    return true;
  }

  return false;
};

export const handleNavigationShortcut = (
  event: KeyboardEvent,
  deps: Pick<KeyboardHandlerDependencies, "goBack" | "goForward">
) => {
  if (event.altKey && event.key === "ArrowLeft") {
    event.preventDefault();
    deps.goBack(usePanelStore.getState().activePanel);
    return true;
  }

  if (event.altKey && event.key === "ArrowRight") {
    event.preventDefault();
    deps.goForward(usePanelStore.getState().activePanel);
    return true;
  }

  return false;
};
