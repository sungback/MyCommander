import { create } from "zustand";
import { FileEntry, PanelState } from "../types/file";

interface AppState {
  leftPanel: PanelState;
  rightPanel: PanelState;
  sizeCache: Record<string, number>;
  activePanel: "left" | "right";
  showHiddenFiles: boolean;
  setActivePanel: (panel: "left" | "right") => void;
  setShowHiddenFiles: (show: boolean) => void;
  setPath: (panel: "left" | "right", path: string) => void;
  setFiles: (panel: "left" | "right", files: FileEntry[]) => void;
  setSelection: (panel: "left" | "right", paths: string[]) => void;
  toggleSelection: (panel: "left" | "right", path: string) => void;
  selectOnly: (panel: "left" | "right", path: string | null) => void;
  clearSelection: (panel: "left" | "right") => void;
  setCursor: (panel: "left" | "right", index: number) => void;
  refreshPanel: (panel: "left" | "right") => void;
  setSort: (panel: "left" | "right", field: string) => void;
  updateEntrySize: (panel: "left" | "right", path: string, size: number) => void;
  // TODO: Add history management
}

type PanelId = "left" | "right";

interface PersistedPanelState {
  activePanel?: PanelId;
  leftPath?: string;
  rightPath?: string;
  showHiddenFiles?: boolean;
}

const PANEL_STATE_STORAGE_KEY = "total-commander:panel-state";

const readPersistedPanelState = (): PersistedPanelState => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawState = window.localStorage.getItem(PANEL_STATE_STORAGE_KEY);
    if (!rawState) {
      return {};
    }

    const parsed = JSON.parse(rawState) as PersistedPanelState;

    return {
      activePanel:
        parsed.activePanel === "left" || parsed.activePanel === "right"
          ? parsed.activePanel
          : undefined,
      leftPath: typeof parsed.leftPath === "string" ? parsed.leftPath : undefined,
      rightPath: typeof parsed.rightPath === "string" ? parsed.rightPath : undefined,
      showHiddenFiles:
        typeof parsed.showHiddenFiles === "boolean" ? parsed.showHiddenFiles : undefined,
    };
  } catch (error) {
    console.error("Failed to restore panel state:", error);
    return {};
  }
};

const writePersistedPanelState = (state: PersistedPanelState) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to persist panel state:", error);
  }
};

const persistedPanelState = readPersistedPanelState();

const sortEntries = (
  entries: FileEntry[],
  field: string,
  direction: "asc" | "desc"
): FileEntry[] => {
  const dirs = entries.filter((e) => e.kind === "directory");
  const files = entries.filter((e) => e.kind !== "directory");

  const compare = (a: any, b: any) => {
    if (a === b) return 0;
    const res = a < b ? -1 : 1;
    return direction === "asc" ? res : -res;
  };

  const sortFn = (a: FileEntry, b: FileEntry) => {
    if (a.name === "..") return -1;
    if (b.name === "..") return 1;

    switch (field) {
      case "size":
        return compare(a.size || 0, b.size || 0);
      case "date":
        return compare(a.lastModified || 0, b.lastModified || 0);
      case "name":
      default:
        return compare(a.name.toLowerCase(), b.name.toLowerCase());
    }
  };

  return [...dirs.sort(sortFn), ...files.sort(sortFn)];
};

const defaultPanelState = (id: PanelId, currentPath?: string): PanelState => ({
  id,
  currentPath: currentPath ?? (id === "left" ? "C:\\" : "D:\\"),
  history: [],
  historyIndex: -1,
  files: [],
  selectedItems: new Set(),
  cursorIndex: 0,
  sortField: "name",
  sortDirection: "asc",
  lastUpdated: Date.now(),
});

const normalizePathKey = (path: string) => path.normalize("NFC");

const applyCachedSizes = (
  entries: FileEntry[],
  sizeCache: Record<string, number>
): FileEntry[] =>
  entries.map((entry) => {
    if (entry.kind !== "directory" || entry.name === "..") {
      return entry;
    }

    const cachedSize = sizeCache[normalizePathKey(entry.path)];
    return cachedSize === undefined ? entry : { ...entry, size: cachedSize };
  });

const updatePanelEntrySize = (
  panelState: PanelState,
  normalizedPath: string,
  size: number
): PanelState => {
  let changed = false;

  const files = panelState.files.map((entry) => {
    if (normalizePathKey(entry.path) === normalizedPath) {
      changed = true;
      return { ...entry, size };
    }

    return entry;
  });

  return changed ? { ...panelState, files } : panelState;
};

const persistVisiblePanelState = (
  leftPanel: PanelState,
  rightPanel: PanelState,
  activePanel: PanelId,
  showHiddenFiles: boolean
) => {
  writePersistedPanelState({
    activePanel,
    leftPath: leftPanel.currentPath,
    rightPath: rightPanel.currentPath,
    showHiddenFiles,
  });
};

export const usePanelStore = create<AppState>((set) => ({
  leftPanel: defaultPanelState("left", persistedPanelState.leftPath),
  rightPanel: defaultPanelState("right", persistedPanelState.rightPath),
  sizeCache: {},
  activePanel: persistedPanelState.activePanel ?? "left",
  showHiddenFiles: persistedPanelState.showHiddenFiles ?? false,

  setActivePanel: (activePanel) =>
    set((state) => {
      persistVisiblePanelState(
        state.leftPanel,
        state.rightPanel,
        activePanel,
        state.showHiddenFiles
      );
      return { activePanel };
    }),

  setShowHiddenFiles: (showHiddenFiles) =>
    set((state) => {
      persistVisiblePanelState(
        state.leftPanel,
        state.rightPanel,
        state.activePanel,
        showHiddenFiles
      );
      return { showHiddenFiles };
    }),

  setPath: (panel, path) =>
    set((state) => {
      const panelKey = panel === "left" ? "leftPanel" : "rightPanel";
      const nextPanelState = {
        ...state[panelKey],
        currentPath: path,
        cursorIndex: 0,
        selectedItems: new Set<string>(),
      };
      const nextState = {
        [panelKey]: {
          ...nextPanelState,
        },
      };

      persistVisiblePanelState(
        panel === "left" ? nextPanelState : state.leftPanel,
        panel === "right" ? nextPanelState : state.rightPanel,
        state.activePanel,
        state.showHiddenFiles
      );

      return nextState;
    }),

  setFiles: (panel, files) =>
    set((state) => {
      const panelKey = panel === "left" ? "leftPanel" : "rightPanel";
      const pState = state[panelKey];
      const filesWithCachedSizes = applyCachedSizes(files, state.sizeCache);
      const sortedFiles = sortEntries(
        filesWithCachedSizes,
        pState.sortField,
        pState.sortDirection
      );
      return {
        [panelKey]: {
          ...pState,
          files: sortedFiles,
        },
      };
    }),

  setSelection: (panel, paths) =>
    set((state) => {
      const panelKey = panel === "left" ? "leftPanel" : "rightPanel";
      return {
        [panelKey]: {
          ...state[panelKey],
          selectedItems: new Set(paths),
        },
      };
    }),

  toggleSelection: (panel, path) =>
    set((state) => {
      const panelKey = panel === "left" ? "leftPanel" : "rightPanel";
      const panelState = state[panelKey];
      const newSelection = new Set(panelState.selectedItems);
      if (newSelection.has(path)) {
        newSelection.delete(path);
      } else {
        newSelection.add(path);
      }
      return {
        [panelKey]: { ...panelState, selectedItems: newSelection },
      };
    }),

  selectOnly: (panel, path) =>
    set((state) => {
      const panelKey = panel === "left" ? "leftPanel" : "rightPanel";
      return {
        [panelKey]: {
          ...state[panelKey],
          selectedItems: path ? new Set([path]) : new Set(),
        },
      };
    }),

  clearSelection: (panel) =>
    set((state) => {
      const panelKey = panel === "left" ? "leftPanel" : "rightPanel";
      return {
        [panelKey]: {
          ...state[panelKey],
          selectedItems: new Set(),
        },
      };
    }),

  setCursor: (panel, cursorIndex) =>
    set((state) => {
      const panelKey = panel === "left" ? "leftPanel" : "rightPanel";
      return {
        [panelKey]: {
          ...state[panelKey],
          cursorIndex,
        },
      };
    }),

  refreshPanel: (panel) =>
    set((state) => {
      const panelKey = panel === "left" ? "leftPanel" : "rightPanel";
      return {
        [panelKey]: {
          ...state[panelKey],
          lastUpdated: Date.now(),
        },
      };
    }),

  setSort: (panel, field) =>
    set((state) => {
      const panelKey = panel === "left" ? "leftPanel" : "rightPanel";
      const pState = state[panelKey];
      const newDirection =
        pState.sortField === field && pState.sortDirection === "asc"
          ? "desc"
          : "asc";

      const sortedFiles = sortEntries(pState.files, field, newDirection as any);

      return {
        [panelKey]: {
          ...pState,
          sortField: field as any,
          sortDirection: newDirection as any,
          files: sortedFiles,
          cursorIndex: 0,
        },
      };
    }),

  updateEntrySize: (_panel, path, size) =>
    set((state) => {
      const normPath = normalizePathKey(path);

      return {
        sizeCache: {
          ...state.sizeCache,
          [normPath]: size,
        },
        leftPanel: updatePanelEntrySize(state.leftPanel, normPath, size),
        rightPanel: updatePanelEntrySize(state.rightPanel, normPath, size),
      };
    }),
}));
