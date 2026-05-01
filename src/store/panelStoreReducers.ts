import type {
  FileEntry,
  PanelId,
  PanelState,
  SortField,
  ViewMode,
} from "../types/file";
import { coalescePanelPath, getPathDirectoryName } from "../utils/path";
import {
  applyCachedSizes,
  cloneTabState,
  defaultTabState,
  normalizePathKey,
  sortEntries,
  syncPanelWithActiveTab,
  updateActiveTab,
  updatePanelEntrySize,
} from "../utils/panelHelpers";

export type PanelViewModes = Record<PanelId, ViewMode>;
export type PanelStateKey = "leftPanel" | "rightPanel";

export const getPanelKey = (panel: PanelId): PanelStateKey =>
  panel === "left" ? "leftPanel" : "rightPanel";

export const addTabToPanel = (panelState: PanelState): PanelState => {
  const activeTab =
    panelState.tabs.find((tab) => tab.id === panelState.activeTabId) ??
    panelState.tabs[0];
  const nextTab = activeTab
    ? cloneTabState(activeTab)
    : defaultTabState(panelState.currentPath);

  return syncPanelWithActiveTab({
    ...panelState,
    tabs: [...panelState.tabs, nextTab],
    activeTabId: nextTab.id,
  });
};

export const activatePanelTab = (
  panelState: PanelState,
  tabId: string
): PanelState | null => {
  if (!panelState.tabs.some((tab) => tab.id === tabId)) {
    return null;
  }

  return syncPanelWithActiveTab({
    ...panelState,
    activeTabId: tabId,
  });
};

export const closePanelTab = (
  panelState: PanelState,
  tabId: string
): PanelState | null => {
  if (panelState.tabs.length <= 1) {
    return null;
  }

  const tabIndex = panelState.tabs.findIndex((tab) => tab.id === tabId);
  if (tabIndex === -1) {
    return null;
  }

  const remainingTabs = panelState.tabs.filter((tab) => tab.id !== tabId);
  const nextActiveTabId =
    panelState.activeTabId === tabId
      ? (remainingTabs[tabIndex] ?? remainingTabs[tabIndex - 1]).id
      : panelState.activeTabId;

  return syncPanelWithActiveTab({
    ...panelState,
    tabs: remainingTabs,
    activeTabId: nextActiveTabId,
  });
};

export const setPanelPath = (
  panelState: PanelState,
  path: string,
  pendingCursorName?: string
): PanelState =>
  updateActiveTab(panelState, (tab) => {
    if (tab.currentPath === path) return tab;

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

export const setPanelResolvedPath = (
  panelState: PanelState,
  path: string
): PanelState =>
  updateActiveTab(panelState, (tab) => {
    if (coalescePanelPath(tab.resolvedPath, tab.currentPath) === path) {
      return tab;
    }

    return {
      ...tab,
      resolvedPath: coalescePanelPath(path, tab.currentPath),
    };
  });

export const setPanelFiles = (
  panelState: PanelState,
  files: FileEntry[],
  sizeCache: Record<string, number>
): PanelState =>
  updateActiveTab(panelState, (tab) => {
    const filesWithCachedSizes = applyCachedSizes(files, sizeCache);
    const sortedFiles = sortEntries(
      filesWithCachedSizes,
      tab.sortField,
      tab.sortDirection
    );

    let cursorIndex = tab.cursorIndex;
    if (tab.pendingCursorName) {
      const idx = sortedFiles.findIndex(
        (file) => file.name === tab.pendingCursorName
      );
      if (idx !== -1) cursorIndex = idx;
    }

    return {
      ...tab,
      files: sortedFiles,
      cursorIndex,
      pendingCursorName: null,
    };
  });

export const setPanelSelection = (
  panelState: PanelState,
  paths: string[]
): PanelState =>
  updateActiveTab(panelState, (tab) => ({
    ...tab,
    selectedItems: new Set(paths),
  }));

export const togglePanelSelection = (
  panelState: PanelState,
  path: string
): PanelState =>
  updateActiveTab(panelState, (tab) => {
    const selectedItems = new Set(tab.selectedItems);
    if (selectedItems.has(path)) {
      selectedItems.delete(path);
    } else {
      selectedItems.add(path);
    }

    return {
      ...tab,
      selectedItems,
    };
  });

export const selectOnlyInPanel = (
  panelState: PanelState,
  path: string | null
): PanelState =>
  updateActiveTab(panelState, (tab) => ({
    ...tab,
    selectedItems: path ? new Set([path]) : new Set(),
  }));

export const clearPanelSelection = (panelState: PanelState): PanelState =>
  selectOnlyInPanel(panelState, null);

export const setPanelPendingCursorName = (
  panelState: PanelState,
  name: string | null
): PanelState =>
  updateActiveTab(panelState, (tab) => ({
    ...tab,
    pendingCursorName: name,
  }));

export const setPanelCursor = (
  panelState: PanelState,
  cursorIndex: number
): PanelState =>
  updateActiveTab(panelState, (tab) => ({
    ...tab,
    cursorIndex,
  }));

export const refreshPanelState = (panelState: PanelState): PanelState =>
  updateActiveTab(panelState, (tab) => ({
    ...tab,
    lastUpdated: Date.now(),
  }));

export const bumpPanelExpandedChildrenVersion = (
  panelState: PanelState
): PanelState =>
  updateActiveTab(panelState, (tab) => ({
    ...tab,
    expandedChildrenVersion: tab.expandedChildrenVersion + 1,
  }));

export const sortPanelByField = (
  panelState: PanelState,
  field: SortField
): PanelState =>
  updateActiveTab(panelState, (tab) => {
    const sortDirection =
      tab.sortField === field && tab.sortDirection === "asc" ? "desc" : "asc";

    return {
      ...tab,
      sortField: field,
      sortDirection,
      files: sortEntries(tab.files, field, sortDirection),
      cursorIndex: 0,
    };
  });

export const navigatePanelHistory = (
  panelState: PanelState,
  direction: -1 | 1
): PanelState | null => {
  const activeTab = panelState.tabs.find(
    (tab) => tab.id === panelState.activeTabId
  );
  if (!activeTab) return null;

  const nextIndex = activeTab.historyIndex + direction;
  if (nextIndex < 0 || nextIndex >= activeTab.history.length) {
    return null;
  }

  const nextPath = activeTab.history[nextIndex];
  if (!nextPath) return null;

  return updateActiveTab(panelState, (tab) => ({
    ...tab,
    currentPath: nextPath,
    resolvedPath: nextPath,
    historyIndex: nextIndex,
    cursorIndex: 0,
    selectedItems: new Set<string>(),
    pendingCursorName: null,
  }));
};

export const swapPanelLocations = (
  leftPanel: PanelState,
  rightPanel: PanelState,
  panelViewModes: PanelViewModes
) => {
  const leftPath = leftPanel.currentPath;
  const rightPath = rightPanel.currentPath;

  if (leftPath === rightPath) {
    return null;
  }

  const leftResolvedPath = coalescePanelPath(leftPanel.resolvedPath, leftPath);
  const rightResolvedPath = coalescePanelPath(rightPanel.resolvedPath, rightPath);
  const now = Date.now();

  return {
    leftPanel: updateActiveTab(leftPanel, (tab) => ({
      ...tab,
      currentPath: rightPath,
      resolvedPath: rightResolvedPath,
      cursorIndex: 0,
      selectedItems: new Set<string>(),
      lastUpdated: now,
    })),
    rightPanel: updateActiveTab(rightPanel, (tab) => ({
      ...tab,
      currentPath: leftPath,
      resolvedPath: leftResolvedPath,
      cursorIndex: 0,
      selectedItems: new Set<string>(),
      lastUpdated: now + 1,
    })),
    panelViewModes: {
      left: panelViewModes.right,
      right: panelViewModes.left,
    },
  };
};

export const updateEntrySizeAcrossPanels = (
  leftPanel: PanelState,
  rightPanel: PanelState,
  path: string,
  size: number
) => {
  const normalizedPath = normalizePathKey(path);

  return {
    normalizedPath,
    leftPanel: updatePanelEntrySize(leftPanel, normalizedPath, size),
    rightPanel: updatePanelEntrySize(rightPanel, normalizedPath, size),
  };
};

export const invalidateEntrySizesAcrossPanels = (
  leftPanel: PanelState,
  rightPanel: PanelState,
  sizeCache: Record<string, number>,
  paths: string[]
) => {
  const pathsToInvalidate = new Set<string>();

  for (const path of paths) {
    if (!path) continue;
    const normalizedPath = normalizePathKey(path);
    pathsToInvalidate.add(normalizedPath);

    let current = path;
    let parent = getPathDirectoryName(current);
    while (parent && parent !== current) {
      pathsToInvalidate.add(normalizePathKey(parent));
      current = parent;
      parent = getPathDirectoryName(current);
    }
  }

  if (pathsToInvalidate.size === 0) {
    return null;
  }

  let changedSizeCache = false;
  const nextSizeCache = { ...sizeCache };

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

  const nextLeftPanel = removeSizesFromPanel(leftPanel);
  const nextRightPanel = removeSizesFromPanel(rightPanel);

  if (
    !changedSizeCache &&
    nextLeftPanel === leftPanel &&
    nextRightPanel === rightPanel
  ) {
    return null;
  }

  return {
    sizeCache: nextSizeCache,
    leftPanel: nextLeftPanel,
    rightPanel: nextRightPanel,
  };
};
