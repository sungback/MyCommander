import type { FileEntry, PanelId, PanelState } from "../../types/file";

export interface CommandTarget {
  entry: FileEntry;
  panelId: PanelId;
  path: string;
}

export interface CommandPaletteItem {
  id: string;
  title: string;
  subtitle: string;
  shortcut?: string;
  keywords: string[];
  disabledReason?: string;
  run: () => void | Promise<void>;
}

export interface CommandPaletteLocation {
  path: string;
  name: string;
  source: "frequent" | "recent";
  visitCount?: number;
}

export interface CommandPaletteActions {
  calculateFolderSizes: () => void | Promise<void>;
  closeApp: () => void | Promise<void>;
  copyCurrentPath: () => void | Promise<void>;
  copyToClipboard: () => void | Promise<void>;
  createZipFromSelection: () => void | Promise<void>;
  cutToClipboard: () => void | Promise<void>;
  extractZip: () => void | Promise<void>;
  openCopy: () => void;
  openDelete: () => void;
  openEditor: () => void | Promise<void>;
  openInfo: () => void;
  openJobCenter: () => void;
  openLocation: (path: string) => void;
  openMkdir: () => void;
  openMove: () => void;
  openNewFile: () => void;
  openPreview: () => void;
  openRename: () => void;
  openSearch: () => void;
  openSettings: () => void;
  openSync: () => void;
  openTerminal: () => void | Promise<void>;
  pasteFromClipboard: () => void;
  swapPanels: () => void;
  syncOtherPanel: () => void;
  toggleHiddenFiles: () => void;
  undoLastFileOperation: () => void | Promise<void>;
}

export const getSelectedCommandPaths = (panel: PanelState): string[] => {
  const selectedPaths = Array.from(panel.selectedItems);
  if (selectedPaths.length > 0) {
    return selectedPaths;
  }

  const cursorEntry = panel.files[panel.cursorIndex];
  if (!cursorEntry || cursorEntry.name === "..") {
    return [];
  }

  return [cursorEntry.path];
};

export const getPrimaryCommandTarget = (
  panel: PanelState,
  panelId: PanelId = panel.id
): CommandTarget | null => {
  const selectedPaths = Array.from(panel.selectedItems);

  if (selectedPaths.length > 1) {
    return null;
  }

  if (selectedPaths.length === 1) {
    const selectedPath = selectedPaths[0];
    const selectedEntry = panel.files.find(
      (entry) => entry.path.normalize("NFC") === selectedPath.normalize("NFC")
    );
    if (!selectedEntry || selectedEntry.name === "..") {
      return null;
    }
    return { entry: selectedEntry, panelId, path: selectedEntry.path };
  }

  const cursorEntry = panel.files[panel.cursorIndex];
  if (!cursorEntry || cursorEntry.name === "..") {
    return null;
  }

  return { entry: cursorEntry, panelId, path: cursorEntry.path };
};

export {
  buildCommandPaletteItems,
  getPanelCommandPath,
  getCommandSelectionLabel,
  type BuildCommandPaletteItemsArgs,
} from "./commandPaletteItems";

export {
  filterCommandPaletteItems,
  moveCommandPaletteSelection,
} from "./commandPaletteSearch";
