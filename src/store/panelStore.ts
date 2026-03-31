import { create } from "zustand";
import { FileEntry, PanelState, PanelTabState } from "../types/file";

type PanelId = "left" | "right";

interface AppState {
  leftPanel: PanelState;
  rightPanel: PanelState;
  sizeCache: Record<string, number>;
  activePanel: PanelId;
  showHiddenFiles: boolean;
  setActivePanel: (panel: PanelId) => void;
  setShowHiddenFiles: (show: boolean) => void;
  addTab: (panel: PanelId) => void;
  activateTab: (panel: PanelId, tabId: string) => void;
  closeTab: (panel: PanelId, tabId: string) => void;
  setPath: (panel: PanelId, path: string) => void;
  setFiles: (panel: PanelId, files: FileEntry[]) => void;
  setSelection: (panel: PanelId, paths: string[]) => void;
  toggleSelection: (panel: PanelId, path: string) => void;
  selectOnly: (panel: PanelId, path: string | null) => void;
  clearSelection: (panel: PanelId) => void;
  setCursor: (panel: PanelId, index: number) => void;
  refreshPanel: (panel: PanelId) => void;
  setSort: (panel: PanelId, field: string) => void;
  updateEntrySize: (panel: PanelId, path: string, size: number) => void;
}

interface PersistedPanelState {
  activePanel?: PanelId;
  leftPath?: string;
  rightPath?: string;
  showHiddenFiles?: boolean;
}

const PANEL_STATE_STORAGE_KEY = "total-commander:panel-state";

const getPanelKey = (panel: PanelId) => (panel === "left" ? "leftPanel" : "rightPanel");

const createTabId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getDefaultPathForPanel = (id: PanelId) => {
  if (typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")) {
    return "/";
  }

  if (typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("WIN")) {
    return id === "left" ? "C:\\" : "D:\\";
  }

  return "/";
};

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

const defaultTabState = (currentPath: string): PanelTabState => ({
  id: createTabId(),
  currentPath,
  history: [],
  historyIndex: -1,
  files: [],
  selectedItems: new Set(),
  cursorIndex: 0,
  sortField: "name",
  sortDirection: "asc",
  lastUpdated: Date.now(),
});

const cloneTabState = (tab: PanelTabState): PanelTabState => ({
  ...tab,
  id: createTabId(),
  files: [...tab.files],
  selectedItems: new Set(),
  cursorIndex: 0,
  lastUpdated: Date.now(),
});

const syncPanelWithActiveTab = (panelState: PanelState): PanelState => {
  const fallbackTab = defaultTabState(getDefaultPathForPanel(panelState.id));
  const tabs = panelState.tabs.length > 0 ? panelState.tabs : [fallbackTab];
  const activeTab =
    tabs.find((tab) => tab.id === panelState.activeTabId) ??
    tabs[0] ??
    fallbackTab;

  return {
    ...panelState,
    activeTabId: activeTab.id,
    tabs,
    currentPath: activeTab.currentPath,
    history: activeTab.history,
    historyIndex: activeTab.historyIndex,
    files: activeTab.files,
    selectedItems: activeTab.selectedItems,
    cursorIndex: activeTab.cursorIndex,
    sortField: activeTab.sortField,
    sortDirection: activeTab.sortDirection,
    lastUpdated: activeTab.lastUpdated,
  };
};

const defaultPanelState = (id: PanelId, currentPath?: string): PanelState => {
  const initialTab = defaultTabState(currentPath ?? getDefaultPathForPanel(id));

  return syncPanelWithActiveTab({
    id,
    tabs: [initialTab],
    activeTabId: initialTab.id,
    currentPath: initialTab.currentPath,
    history: initialTab.history,
    historyIndex: initialTab.historyIndex,
    files: initialTab.files,
    selectedItems: initialTab.selectedItems,
    cursorIndex: initialTab.cursorIndex,
    sortField: initialTab.sortField,
    sortDirection: initialTab.sortDirection,
    lastUpdated: initialTab.lastUpdated,
  });
};

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

const updateTab = (
  panelState: PanelState,
  tabId: string,
  updater: (tab: PanelTabState) => PanelTabState
): PanelState => {
  const tabs = panelState.tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab));
  return syncPanelWithActiveTab({ ...panelState, tabs });
};

const updateActiveTab = (
  panelState: PanelState,
  updater: (tab: PanelTabState) => PanelTabState
): PanelState => updateTab(panelState, panelState.activeTabId, updater);

const updatePanelEntrySize = (
  panelState: PanelState,
  normalizedPath: string,
  size: number
): PanelState => {
  let changed = false;

  const tabs = panelState.tabs.map((tab) => {
    let tabChanged = false;
    const files = tab.files.map((entry) => {
      if (normalizePathKey(entry.path) === normalizedPath) {
        tabChanged = true;
        changed = true;
        return { ...entry, size };
      }

      return entry;
    });

    return tabChanged ? { ...tab, files } : tab;
  });

  return changed ? syncPanelWithActiveTab({ ...panelState, tabs }) : panelState;
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

  addTab: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const currentPanel = state[panelKey];
      const activeTab =
        currentPanel.tabs.find((tab) => tab.id === currentPanel.activeTabId) ??
        currentPanel.tabs[0];
      const nextTab = activeTab
        ? cloneTabState(activeTab)
        : defaultTabState(currentPanel.currentPath);
      const nextPanelState = syncPanelWithActiveTab({
        ...currentPanel,
        tabs: [...currentPanel.tabs, nextTab],
        activeTabId: nextTab.id,
      });

      persistVisiblePanelState(
        panel === "left" ? nextPanelState : state.leftPanel,
        panel === "right" ? nextPanelState : state.rightPanel,
        state.activePanel,
        state.showHiddenFiles
      );

      return {
        [panelKey]: nextPanelState,
      };
    }),

  activateTab: (panel, tabId) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const currentPanel = state[panelKey];

      if (!currentPanel.tabs.some((tab) => tab.id === tabId)) {
        return {};
      }

      const nextPanelState = syncPanelWithActiveTab({
        ...currentPanel,
        activeTabId: tabId,
      });

      persistVisiblePanelState(
        panel === "left" ? nextPanelState : state.leftPanel,
        panel === "right" ? nextPanelState : state.rightPanel,
        state.activePanel,
        state.showHiddenFiles
      );

      return {
        [panelKey]: nextPanelState,
      };
    }),

  closeTab: (panel, tabId) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const currentPanel = state[panelKey];

      if (currentPanel.tabs.length <= 1) {
        return {};
      }

      const tabIndex = currentPanel.tabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) {
        return {};
      }

      const remainingTabs = currentPanel.tabs.filter((tab) => tab.id !== tabId);
      const nextActiveTabId =
        currentPanel.activeTabId === tabId
          ? (remainingTabs[tabIndex] ?? remainingTabs[tabIndex - 1]).id
          : currentPanel.activeTabId;

      const nextPanelState = syncPanelWithActiveTab({
        ...currentPanel,
        tabs: remainingTabs,
        activeTabId: nextActiveTabId,
      });

      persistVisiblePanelState(
        panel === "left" ? nextPanelState : state.leftPanel,
        panel === "right" ? nextPanelState : state.rightPanel,
        state.activePanel,
        state.showHiddenFiles
      );

      return {
        [panelKey]: nextPanelState,
      };
    }),

  setPath: (panel, path) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => ({
        ...tab,
        currentPath: path,
        cursorIndex: 0,
        selectedItems: new Set<string>(),
      }));

      persistVisiblePanelState(
        panel === "left" ? nextPanelState : state.leftPanel,
        panel === "right" ? nextPanelState : state.rightPanel,
        state.activePanel,
        state.showHiddenFiles
      );

      return {
        [panelKey]: nextPanelState,
      };
    }),

  setFiles: (panel, files) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => {
        const filesWithCachedSizes = applyCachedSizes(files, state.sizeCache);
        const sortedFiles = sortEntries(filesWithCachedSizes, tab.sortField, tab.sortDirection);

        return {
          ...tab,
          files: sortedFiles,
        };
      });

      return {
        [panelKey]: nextPanelState,
      };
    }),

  setSelection: (panel, paths) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => ({
        ...tab,
        selectedItems: new Set(paths),
      }));

      return {
        [panelKey]: nextPanelState,
      };
    }),

  toggleSelection: (panel, path) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => {
        const newSelection = new Set(tab.selectedItems);
        if (newSelection.has(path)) {
          newSelection.delete(path);
        } else {
          newSelection.add(path);
        }

        return {
          ...tab,
          selectedItems: newSelection,
        };
      });

      return {
        [panelKey]: nextPanelState,
      };
    }),

  selectOnly: (panel, path) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => ({
        ...tab,
        selectedItems: path ? new Set([path]) : new Set(),
      }));

      return {
        [panelKey]: nextPanelState,
      };
    }),

  clearSelection: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => ({
        ...tab,
        selectedItems: new Set(),
      }));

      return {
        [panelKey]: nextPanelState,
      };
    }),

  setCursor: (panel, cursorIndex) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => ({
        ...tab,
        cursorIndex,
      }));

      return {
        [panelKey]: nextPanelState,
      };
    }),

  refreshPanel: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => ({
        ...tab,
        lastUpdated: Date.now(),
      }));

      return {
        [panelKey]: nextPanelState,
      };
    }),

  setSort: (panel, field) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => {
        const newDirection =
          tab.sortField === field && tab.sortDirection === "asc" ? "desc" : "asc";

        return {
          ...tab,
          sortField: field as any,
          sortDirection: newDirection,
          files: sortEntries(tab.files, field, newDirection),
          cursorIndex: 0,
        };
      });

      return {
        [panelKey]: nextPanelState,
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
