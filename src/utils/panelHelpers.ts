import { FileEntry, PanelId, PanelState, PanelTabState } from "../types/file";
import { ThemePreference } from "../types/theme";
import { coalescePanelPath } from "./path";
import {
  createTabId,
  PersistedPanelData,
  writePersistedPanelState,
} from "../store/persistence";

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

export const getDefaultPathForPanel = (id: PanelId) => {
  if (typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")) {
    return "/";
  }

  if (typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("WIN")) {
    return id === "left" ? "C:\\" : "D:\\";
  }

  return "/";
};

export const defaultTabState = (currentPath: string): PanelTabState => ({
  id: createTabId(),
  currentPath,
  resolvedPath: currentPath,
  history: [],
  historyIndex: -1,
  files: [],
  selectedItems: new Set(),
  cursorIndex: 0,
  sortField: "name",
  sortDirection: "asc",
  lastUpdated: Date.now(),
  pendingCursorName: null,
  expandedChildrenVersion: 0,
});

export const cloneTabState = (tab: PanelTabState): PanelTabState => ({
  ...tab,
  id: createTabId(),
  files: [...tab.files],
  selectedItems: new Set(),
  cursorIndex: 0,
  lastUpdated: Date.now(),
  expandedChildrenVersion: 0,
});

export const syncPanelWithActiveTab = (panelState: PanelState): PanelState => {
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
    resolvedPath: coalescePanelPath(activeTab.resolvedPath, activeTab.currentPath),
    history: activeTab.history,
    historyIndex: activeTab.historyIndex,
    files: activeTab.files,
    selectedItems: activeTab.selectedItems,
    cursorIndex: activeTab.cursorIndex,
    sortField: activeTab.sortField,
    sortDirection: activeTab.sortDirection,
    lastUpdated: activeTab.lastUpdated,
    pendingCursorName: activeTab.pendingCursorName,
  };
};

export const defaultPanelState = (id: PanelId, currentPath?: string): PanelState => {
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

export const restorePersistedPanelState = (
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
    resolvedPath: tab.currentPath,
    history: [...tab.history],
    historyIndex: tab.historyIndex,
    files: [],
    selectedItems: new Set<string>(),
    cursorIndex: 0,
    sortField: tab.sortField,
    sortDirection: tab.sortDirection,
    lastUpdated: Date.now(),
    pendingCursorName: null,
    expandedChildrenVersion: 0,
  }));

  const activeTabId = tabs.some((tab) => tab.id === persistedPanel.activeTabId)
    ? persistedPanel.activeTabId ?? tabs[0].id
    : tabs[0].id;

  return syncPanelWithActiveTab({
    id,
    tabs,
    activeTabId,
    currentPath: tabs[0].currentPath,
    resolvedPath: coalescePanelPath(tabs[0].resolvedPath, tabs[0].currentPath),
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

export const normalizePathKey = (path: string) => path.normalize("NFC");

export const applyCachedSizes = (
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

export const updateTab = (
  panelState: PanelState,
  tabId: string,
  updater: (tab: PanelTabState) => PanelTabState
): PanelState => {
  const tabs = panelState.tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab));
  return syncPanelWithActiveTab({ ...panelState, tabs });
};

export const updateActiveTab = (
  panelState: PanelState,
  updater: (tab: PanelTabState) => PanelTabState
): PanelState => updateTab(panelState, panelState.activeTabId, updater);

export const updatePanelEntrySize = (
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

export const persistVisiblePanelState = (
  leftPanel: PanelState,
  rightPanel: PanelState,
  activePanel: PanelId,
  showHiddenFiles: boolean,
  themePreference: ThemePreference,
  panelViewModes: Record<PanelId, "brief" | "detailed">
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
