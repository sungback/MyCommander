import { create } from "zustand";
import { FileEntry, PanelState, ViewMode, PanelId, SortField } from "../types/file";
import { ThemePreference } from "../types/theme";
import { coalescePanelPath, getPathDirectoryName } from "../utils/path";
import { readPersistedPanelState } from "./persistence";
import {
  applyCachedSizes,
  cloneTabState,
  defaultTabState,
  normalizePathKey,
  persistVisiblePanelState,
  restorePersistedPanelState,
  sortEntries,
  syncPanelWithActiveTab,
  updateActiveTab,
  updatePanelEntrySize,
} from "../utils/panelHelpers";

type PanelViewModes = Record<PanelId, ViewMode>;


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
  setResolvedPath: (panel: PanelId, path: string) => void;
  goBack: (panel: PanelId) => void;
  goForward: (panel: PanelId) => void;
  setFiles: (panel: PanelId, files: FileEntry[]) => void;
  setSelection: (panel: PanelId, paths: string[]) => void;
  setPendingCursorName: (panel: PanelId, name: string | null) => void;
  toggleSelection: (panel: PanelId, path: string) => void;
  selectOnly: (panel: PanelId, path: string | null) => void;
  clearSelection: (panel: PanelId) => void;
  setCursor: (panel: PanelId, index: number) => void;
  refreshPanel: (panel: PanelId) => void;
  bumpExpandedChildrenVersion: (panel: PanelId) => void;
  setSort: (panel: PanelId, field: SortField) => void;
  updateEntrySize: (panel: PanelId, path: string, size: number) => void;
  invalidateEntrySizes: (paths: string[]) => void;
  swapPanels: () => void;
}

const getPanelKey = (panel: PanelId) => (panel === "left" ? "leftPanel" : "rightPanel");

const getPanelsAfterUpdate = (
  state: AppState,
  panel: PanelId,
  nextPanelState: PanelState
) => ({
  leftPanel: panel === "left" ? nextPanelState : state.leftPanel,
  rightPanel: panel === "right" ? nextPanelState : state.rightPanel,
});

const persistPanelUpdate = (
  state: AppState,
  panel: PanelId,
  nextPanelState: PanelState
) => {
  const { leftPanel, rightPanel } = getPanelsAfterUpdate(
    state,
    panel,
    nextPanelState
  );

  persistVisiblePanelState(
    leftPanel,
    rightPanel,
    state.activePanel,
    state.showHiddenFiles,
    state.themePreference,
    state.panelViewModes
  );
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

    swapPanels: () =>
      set((state) => {
        const leftPath = state.leftPanel.currentPath;
        const rightPath = state.rightPanel.currentPath;
        const leftResolvedPath = coalescePanelPath(
          state.leftPanel.resolvedPath,
          leftPath
        );
        const rightResolvedPath = coalescePanelPath(
          state.rightPanel.resolvedPath,
          rightPath
        );

        if (leftPath === rightPath) return state;

        const now = Date.now();
        const newLeft = updateActiveTab(state.leftPanel, (tab) => ({
          ...tab,
          currentPath: rightPath,
          resolvedPath: rightResolvedPath,
          cursorIndex: 0,
          selectedItems: new Set<string>(),
          lastUpdated: now,
        }));
        const newRight = updateActiveTab(state.rightPanel, (tab) => ({
          ...tab,
          currentPath: leftPath,
          resolvedPath: leftResolvedPath,
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

        persistPanelUpdate(state, panel, nextPanelState);

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

        persistPanelUpdate(state, panel, nextPanelState);

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

      persistPanelUpdate(state, panel, nextPanelState);

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
          resolvedPath: path,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          cursorIndex: 0,
          selectedItems: new Set<string>(),
          pendingCursorName: pendingCursorName ?? null,
        };
      });

      persistPanelUpdate(state, panel, nextPanelState);

      return {
        [panelKey]: nextPanelState,
      };
    }),

  setResolvedPath: (panel, path) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => {
        if (coalescePanelPath(tab.resolvedPath, tab.currentPath) === path) {
          return tab;
        }

        return {
          ...tab,
          resolvedPath: coalescePanelPath(path, tab.currentPath),
        };
      });

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

  setPendingCursorName: (panel, name) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => ({
        ...tab,
        pendingCursorName: name,
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

  bumpExpandedChildrenVersion: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = updateActiveTab(state[panelKey], (tab) => ({
        ...tab,
        expandedChildrenVersion: tab.expandedChildrenVersion + 1,
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
          sortField: field,
          sortDirection: newDirection,
          files: sortEntries(tab.files, field, newDirection),
          cursorIndex: 0,
        };
      });

      persistPanelUpdate(state, panel, nextPanelState);

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
        resolvedPath: newPath,
        historyIndex: newIndex,
        cursorIndex: 0,
        selectedItems: new Set<string>(),
        pendingCursorName: null,
      }));

      persistPanelUpdate(state, panel, nextPanelState);

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
        resolvedPath: newPath,
        historyIndex: newIndex,
        cursorIndex: 0,
        selectedItems: new Set<string>(),
        pendingCursorName: null,
      }));

      persistPanelUpdate(state, panel, nextPanelState);

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

  invalidateEntrySizes: (paths) =>
    set((state) => {
      const pathsToInvalidate = new Set<string>();

      for (const path of paths) {
        if (!path) continue;
        const norm = normalizePathKey(path);
        pathsToInvalidate.add(norm);

        let current = path;
        let parent = getPathDirectoryName(current);
        while (parent && parent !== current) {
          pathsToInvalidate.add(normalizePathKey(parent));
          current = parent;
          parent = getPathDirectoryName(current);
        }
      }

      if (pathsToInvalidate.size === 0) return state;

      let changedSizeCache = false;
      const nextSizeCache = { ...state.sizeCache };

      for (const path of pathsToInvalidate) {
        if (nextSizeCache[path] !== undefined) {
          delete nextSizeCache[path];
          changedSizeCache = true;
        }
      }

      const removeSizesFromPanel = (panelState: PanelState): PanelState => {
        let panelChanged = false;
        const tabs = panelState.tabs.map((tab) => {
          let tabChanged = false;
          const files = tab.files.map((entry) => {
            if (
              entry.kind === "directory" &&
              pathsToInvalidate.has(normalizePathKey(entry.path)) &&
              entry.size !== undefined
            ) {
              tabChanged = true;
              panelChanged = true;
              return { ...entry, size: undefined };
            }
            return entry;
          });
          return tabChanged ? { ...tab, files } : tab;
        });

        return panelChanged
          ? syncPanelWithActiveTab({ ...panelState, tabs })
          : panelState;
      };

      const nextLeft = removeSizesFromPanel(state.leftPanel);
      const nextRight = removeSizesFromPanel(state.rightPanel);

      if (
        !changedSizeCache &&
        nextLeft === state.leftPanel &&
        nextRight === state.rightPanel
      ) {
        return state;
      }

      return {
        sizeCache: nextSizeCache,
        leftPanel: nextLeft,
        rightPanel: nextRight,
      };
    }),
  };
});
