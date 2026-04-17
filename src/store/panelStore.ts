import { create } from "zustand";
import {
  FileEntry,
  PanelState,
  PanelTabState,
  SortDirection,
  SortField,
  ViewMode,
} from "../types/file";
import { ThemePreference } from "../types/theme";

type PanelId = "left" | "right";
type PanelViewModes = Record<PanelId, ViewMode>;

export interface DragInfo {
  paths: string[];
  directoryPaths: string[];
  sourcePanel: PanelId;
}

export interface ClipboardState {
  paths: string[];
  operation: "copy" | "cut";
  sourcePanel: PanelId;
}

interface AppState {
  leftPanel: PanelState;
  rightPanel: PanelState;
  sizeCache: Record<string, number>;
  activePanel: PanelId;
  showHiddenFiles: boolean;
  themePreference: ThemePreference;
  panelViewModes: PanelViewModes;
  setActivePanel: (panel: PanelId) => void;
  setShowHiddenFiles: (show: boolean) => void;
  setThemePreference: (themePreference: ThemePreference) => void;
  setPanelViewMode: (panel: PanelId, viewMode: ViewMode) => void;
  addTab: (panel: PanelId) => void;
  activateTab: (panel: PanelId, tabId: string) => void;
  closeTab: (panel: PanelId, tabId: string) => void;
  setPath: (panel: PanelId, path: string, pendingCursorName?: string) => void;
  goBack: (panel: PanelId) => void;
  goForward: (panel: PanelId) => void;
  setFiles: (panel: PanelId, files: FileEntry[]) => void;
  setSelection: (panel: PanelId, paths: string[]) => void;
  toggleSelection: (panel: PanelId, path: string) => void;
  selectOnly: (panel: PanelId, path: string | null) => void;
  clearSelection: (panel: PanelId) => void;
  setCursor: (panel: PanelId, index: number) => void;
  refreshPanel: (panel: PanelId) => void;
  setSort: (panel: PanelId, field: string) => void;
  updateEntrySize: (panel: PanelId, path: string, size: number) => void;
  dragInfo: DragInfo | null;
  setDragInfo: (info: DragInfo | null) => void;
  clipboard: ClipboardState | null;
  setClipboard: (state: ClipboardState) => void;
  clearClipboard: () => void;
  swapPanels: () => void;
}

interface PersistedPanelState {
  activePanel?: PanelId;
  leftPath?: string;
  rightPath?: string;
  leftPanel?: PersistedPanelData;
  rightPanel?: PersistedPanelData;
  showHiddenFiles?: boolean;
  themePreference?: ThemePreference;
  viewMode?: ViewMode;
  leftViewMode?: ViewMode;
  rightViewMode?: ViewMode;
}

interface PersistedPanelData {
  tabs: PersistedTabState[];
  activeTabId?: string;
}

interface PersistedTabState {
  id: string;
  currentPath: string;
  history: string[];
  historyIndex: number;
  sortField: SortField;
  sortDirection: SortDirection;
}

const PANEL_STATE_STORAGE_KEY = "total-commander:panel-state";

const getPanelKey = (panel: PanelId) => (panel === "left" ? "leftPanel" : "rightPanel");

const createTabId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isSortField = (value: unknown): value is SortField =>
  value === "name" || value === "ext" || value === "size" || value === "date";

const isSortDirection = (value: unknown): value is SortDirection =>
  value === "asc" || value === "desc";

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

    const restoreTab = (tab: unknown): PersistedTabState | null => {
      if (!tab || typeof tab !== "object") {
        return null;
      }

      const currentPath = Reflect.get(tab, "currentPath");
      if (typeof currentPath !== "string" || currentPath.length === 0) {
        return null;
      }

      const historyValue = Reflect.get(tab, "history");
      const history = Array.isArray(historyValue)
        ? historyValue.filter((entry): entry is string => typeof entry === "string")
        : [];
      const historyIndexValue = Reflect.get(tab, "historyIndex");
      const clampedHistoryIndex =
        typeof historyIndexValue === "number" && Number.isFinite(historyIndexValue)
          ? Math.min(Math.max(Math.trunc(historyIndexValue), -1), history.length - 1)
          : -1;
      const sortField = isSortField(Reflect.get(tab, "sortField"))
        ? (Reflect.get(tab, "sortField") as SortField)
        : "name";
      const sortDirection = isSortDirection(Reflect.get(tab, "sortDirection"))
        ? (Reflect.get(tab, "sortDirection") as SortDirection)
        : "asc";

      return {
        id:
          typeof Reflect.get(tab, "id") === "string" && Reflect.get(tab, "id")
            ? (Reflect.get(tab, "id") as string)
            : createTabId(),
        currentPath,
        history,
        historyIndex: clampedHistoryIndex,
        sortField,
        sortDirection,
      };
    };

    const restorePanel = (panel: unknown): PersistedPanelData | undefined => {
      if (!panel || typeof panel !== "object") {
        return undefined;
      }

      const tabsValue = Reflect.get(panel, "tabs");
      const tabs = Array.isArray(tabsValue)
        ? tabsValue
            .map((tab) => restoreTab(tab))
            .filter((tab): tab is PersistedTabState => tab !== null)
        : [];

      if (tabs.length === 0) {
        return undefined;
      }

      const activeTabId = Reflect.get(panel, "activeTabId");

      return {
        tabs,
        activeTabId: typeof activeTabId === "string" ? activeTabId : undefined,
      };
    };

    return {
      activePanel:
        parsed.activePanel === "left" || parsed.activePanel === "right"
          ? parsed.activePanel
          : undefined,
      leftPath: typeof parsed.leftPath === "string" ? parsed.leftPath : undefined,
      rightPath: typeof parsed.rightPath === "string" ? parsed.rightPath : undefined,
      leftPanel: restorePanel(parsed.leftPanel),
      rightPanel: restorePanel(parsed.rightPanel),
      showHiddenFiles:
        typeof parsed.showHiddenFiles === "boolean" ? parsed.showHiddenFiles : undefined,
      themePreference:
        parsed.themePreference === "auto" ||
        parsed.themePreference === "light" ||
        parsed.themePreference === "dark"
          ? parsed.themePreference
          : undefined,
      viewMode:
        parsed.viewMode === "brief" || parsed.viewMode === "detailed"
          ? parsed.viewMode
          : undefined,
      leftViewMode:
        parsed.leftViewMode === "brief" || parsed.leftViewMode === "detailed"
          ? parsed.leftViewMode
          : undefined,
      rightViewMode:
        parsed.rightViewMode === "brief" || parsed.rightViewMode === "detailed"
          ? parsed.rightViewMode
          : undefined,
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

export const sortEntries = (
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
  pendingCursorName: null,
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
    pendingCursorName: null,
  });
};

const restorePersistedPanelState = (
  id: PanelId,
  persistedPanel?: PersistedPanelData,
  fallbackPath?: string
): PanelState => {
  if (!persistedPanel || persistedPanel.tabs.length === 0) {
    return defaultPanelState(id, fallbackPath);
  }

  const tabs: PanelTabState[] = persistedPanel.tabs.map((tab) => ({
    id: tab.id,
    currentPath: tab.currentPath,
    history: [...tab.history],
    historyIndex: tab.historyIndex,
    files: [],
    selectedItems: new Set<string>(),
    cursorIndex: 0,
    sortField: tab.sortField,
    sortDirection: tab.sortDirection,
    lastUpdated: Date.now(),
    pendingCursorName: null,
  }));

  const activeTabId = tabs.some((tab) => tab.id === persistedPanel.activeTabId)
    ? persistedPanel.activeTabId ?? tabs[0].id
    : tabs[0].id;

  return syncPanelWithActiveTab({
    id,
    tabs,
    activeTabId,
    currentPath: tabs[0].currentPath,
    history: tabs[0].history,
    historyIndex: tabs[0].historyIndex,
    files: tabs[0].files,
    selectedItems: tabs[0].selectedItems,
    cursorIndex: tabs[0].cursorIndex,
    sortField: tabs[0].sortField,
    sortDirection: tabs[0].sortDirection,
    lastUpdated: tabs[0].lastUpdated,
    pendingCursorName: null,
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

    return tabChanged
      ? { ...tab, files: sortEntries(files, tab.sortField, tab.sortDirection) }
      : tab;
  });

  return changed ? syncPanelWithActiveTab({ ...panelState, tabs }) : panelState;
};

const persistVisiblePanelState = (
  leftPanel: PanelState,
  rightPanel: PanelState,
  activePanel: PanelId,
  showHiddenFiles: boolean,
  themePreference: ThemePreference,
  panelViewModes: PanelViewModes
) => {
  const serializePanel = (panel: PanelState): PersistedPanelData => ({
    activeTabId: panel.activeTabId,
    tabs: panel.tabs.map((tab) => ({
      id: tab.id,
      currentPath: tab.currentPath,
      history: [...tab.history],
      historyIndex: tab.historyIndex,
      sortField: tab.sortField,
      sortDirection: tab.sortDirection,
    })),
  });

  writePersistedPanelState({
    activePanel,
    leftPath: leftPanel.currentPath,
    rightPath: rightPanel.currentPath,
    leftPanel: serializePanel(leftPanel),
    rightPanel: serializePanel(rightPanel),
    showHiddenFiles,
    themePreference,
    leftViewMode: panelViewModes.left,
    rightViewMode: panelViewModes.right,
  });
};

export const usePanelStore = create<AppState>((set) => {
  const persistedPanelState = readPersistedPanelState();
  const panelViewModes: PanelViewModes = {
    left: persistedPanelState.leftViewMode ?? persistedPanelState.viewMode ?? "detailed",
    right: persistedPanelState.rightViewMode ?? persistedPanelState.viewMode ?? "detailed",
  };

  return {
    leftPanel: restorePersistedPanelState(
      "left",
      persistedPanelState.leftPanel,
      persistedPanelState.leftPath
    ),
    rightPanel: restorePersistedPanelState(
      "right",
      persistedPanelState.rightPanel,
      persistedPanelState.rightPath
    ),
    sizeCache: {},
    activePanel: persistedPanelState.activePanel ?? "left",
    showHiddenFiles: persistedPanelState.showHiddenFiles ?? false,
    themePreference: persistedPanelState.themePreference ?? "auto",
    panelViewModes,
    dragInfo: null,
    clipboard: null,

    setDragInfo: (dragInfo) => set({ dragInfo }),
    setClipboard: (clipboard) => set({ clipboard }),
    clearClipboard: () => set({ clipboard: null }),

    swapPanels: () =>
      set((state) => {
        const leftPath = state.leftPanel.currentPath;
        const rightPath = state.rightPanel.currentPath;

        if (leftPath === rightPath) return state;

        const now = Date.now();
        const newLeft = updateActiveTab(state.leftPanel, (tab) => ({
          ...tab,
          currentPath: rightPath,
          cursorIndex: 0,
          selectedItems: new Set<string>(),
          lastUpdated: now,
        }));
        const newRight = updateActiveTab(state.rightPanel, (tab) => ({
          ...tab,
          currentPath: leftPath,
          cursorIndex: 0,
          selectedItems: new Set<string>(),
          lastUpdated: now + 1,
        }));
        const newViewModes: PanelViewModes = {
          left: state.panelViewModes.right,
          right: state.panelViewModes.left,
        };

        persistVisiblePanelState(
          newLeft,
          newRight,
          state.activePanel,
          state.showHiddenFiles,
          state.themePreference,
          newViewModes
        );

        return { leftPanel: newLeft, rightPanel: newRight, panelViewModes: newViewModes };
      }),

    setActivePanel: (activePanel) =>
      set((state) => {
        persistVisiblePanelState(
          state.leftPanel,
          state.rightPanel,
          activePanel,
          state.showHiddenFiles,
          state.themePreference,
          state.panelViewModes
        );
        return { activePanel };
      }),

    setShowHiddenFiles: (showHiddenFiles) =>
      set((state) => {
        persistVisiblePanelState(
          state.leftPanel,
          state.rightPanel,
          state.activePanel,
          showHiddenFiles,
          state.themePreference,
          state.panelViewModes
        );
        return { showHiddenFiles };
      }),

    setThemePreference: (themePreference) =>
      set((state) => {
        persistVisiblePanelState(
          state.leftPanel,
          state.rightPanel,
          state.activePanel,
          state.showHiddenFiles,
          themePreference,
          state.panelViewModes
        );
        return { themePreference };
      }),

    setPanelViewMode: (panel, viewMode) =>
      set((state) => {
        const nextPanelViewModes = {
          ...state.panelViewModes,
          [panel]: viewMode,
        };
        persistVisiblePanelState(
          state.leftPanel,
          state.rightPanel,
          state.activePanel,
          state.showHiddenFiles,
          state.themePreference,
          nextPanelViewModes
        );
        return { panelViewModes: nextPanelViewModes };
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
          state.showHiddenFiles,
          state.themePreference,
          state.panelViewModes
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
          state.showHiddenFiles,
          state.themePreference,
          state.panelViewModes
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
        state.showHiddenFiles,
        state.themePreference,
        state.panelViewModes
      );

      return {
        [panelKey]: nextPanelState,
      };
    }),

  setPath: (panel, path, pendingCursorName) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => {
        if (tab.currentPath === path) return tab;

        // Truncate any forward history, then append new path (cap at 100)
        const prevEntries =
          tab.historyIndex >= 0 ? tab.history.slice(0, tab.historyIndex + 1) : [];
        const base = prevEntries.length === 0 ? [tab.currentPath] : prevEntries;
        const newHistory = [...base, path].slice(-100);
        return {
          ...tab,
          currentPath: path,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          cursorIndex: 0,
          selectedItems: new Set<string>(),
          pendingCursorName: pendingCursorName ?? null,
        };
      });

      persistVisiblePanelState(
        panel === "left" ? nextPanelState : state.leftPanel,
        panel === "right" ? nextPanelState : state.rightPanel,
        state.activePanel,
        state.showHiddenFiles,
        state.themePreference,
        state.panelViewModes
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

        let cursorIndex = tab.cursorIndex;
        if (tab.pendingCursorName) {
          const idx = sortedFiles.findIndex((f) => f.name === tab.pendingCursorName);
          if (idx !== -1) cursorIndex = idx;
        }

        return {
          ...tab,
          files: sortedFiles,
          cursorIndex,
          pendingCursorName: null,
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

      persistVisiblePanelState(
        panel === "left" ? nextPanelState : state.leftPanel,
        panel === "right" ? nextPanelState : state.rightPanel,
        state.activePanel,
        state.showHiddenFiles,
        state.themePreference,
        state.panelViewModes
      );

      return {
        [panelKey]: nextPanelState,
      };
    }),

  goBack: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const currentPanel = state[panelKey];
      const activeTab = currentPanel.tabs.find((t) => t.id === currentPanel.activeTabId);
      if (!activeTab || activeTab.historyIndex <= 0) return state;

      const newIndex = activeTab.historyIndex - 1;
      const newPath = activeTab.history[newIndex];
      if (!newPath) return state;

      const nextPanelState = updateActiveTab(currentPanel, (tab) => ({
        ...tab,
        currentPath: newPath,
        historyIndex: newIndex,
        cursorIndex: 0,
        selectedItems: new Set<string>(),
        pendingCursorName: null,
      }));

      persistVisiblePanelState(
        panel === "left" ? nextPanelState : state.leftPanel,
        panel === "right" ? nextPanelState : state.rightPanel,
        state.activePanel,
        state.showHiddenFiles,
        state.themePreference,
        state.panelViewModes
      );

      return { [panelKey]: nextPanelState };
    }),

  goForward: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const currentPanel = state[panelKey];
      const activeTab = currentPanel.tabs.find((t) => t.id === currentPanel.activeTabId);
      if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return state;

      const newIndex = activeTab.historyIndex + 1;
      const newPath = activeTab.history[newIndex];
      if (!newPath) return state;

      const nextPanelState = updateActiveTab(currentPanel, (tab) => ({
        ...tab,
        currentPath: newPath,
        historyIndex: newIndex,
        cursorIndex: 0,
        selectedItems: new Set<string>(),
        pendingCursorName: null,
      }));

      persistVisiblePanelState(
        panel === "left" ? nextPanelState : state.leftPanel,
        panel === "right" ? nextPanelState : state.rightPanel,
        state.activePanel,
        state.showHiddenFiles,
        state.themePreference,
        state.panelViewModes
      );

      return { [panelKey]: nextPanelState };
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
  };
});
