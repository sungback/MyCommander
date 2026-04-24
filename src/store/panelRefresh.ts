import { usePanelStore } from "./panelStore";
import { PanelState, PanelTabState } from "../types/file";
import {
  coalescePanelPath,
  getPathDirectoryName,
  isSameOrNestedPath,
  normalizePathForComparison,
} from "../utils/path";

type PanelId = "left" | "right";

const PANEL_IDS: PanelId[] = ["left", "right"];

const getNormalizedPanelPath = (path?: string | null) => {
  if (typeof path !== "string" || path.length === 0) {
    return null;
  }

  return normalizePathForComparison(path);
};

const syncPanelWithActiveTab = (panelState: PanelState, tabs: PanelTabState[]): PanelState => {
  const activeTab =
    tabs.find((tab) => tab.id === panelState.activeTabId) ??
    tabs[0] ?? {
      ...panelState,
      id: panelState.activeTabId,
    };

  return {
    ...panelState,
    tabs,
    activeTabId: activeTab.id,
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

const updatePanelTabs = (
  panelState: PanelState,
  updater: (tab: PanelTabState) => PanelTabState
): PanelState => {
  let changed = false;

  const tabs = panelState.tabs.map((tab) => {
    const nextTab = updater(tab);
    if (nextTab !== tab) {
      changed = true;
    }
    return nextTab;
  });

  return changed ? syncPanelWithActiveTab(panelState, tabs) : panelState;
};

export const refreshPanelsForDirectories = (directories: string[]) => {
  const normalizedDirectories = new Set(
    directories
      .filter((directory) => directory.length > 0)
      .map((directory) => normalizePathForComparison(directory))
  );

  if (normalizedDirectories.size === 0) {
    return;
  }

  const state = usePanelStore.getState();
  state.invalidateEntrySizes(directories);

  const now = Date.now();
  let changed = false;
  const nextPanels = {} as Partial<Record<`${PanelId}Panel`, PanelState>>;
  const setState = Reflect.get(usePanelStore, "setState");

  for (const panelId of PANEL_IDS) {
    const panel = panelId === "left" ? state.leftPanel : state.rightPanel;

    const nextPanel = updatePanelTabs(panel, (tab) => {
      const tabPath = coalescePanelPath(tab.resolvedPath, tab.currentPath);
      const normalizedCurrentPath = getNormalizedPanelPath(tabPath);

      if (!normalizedCurrentPath) {
        return tab;
      }

      let nextLastUpdated = tab.lastUpdated;
      let nextExpandedChildrenVersion = tab.expandedChildrenVersion;

      if (normalizedDirectories.has(normalizedCurrentPath)) {
        nextLastUpdated = now;
      }

      const nestedPrefix = normalizedCurrentPath.endsWith("/")
        ? normalizedCurrentPath
        : `${normalizedCurrentPath}/`;
      const hasNestedChange = [...normalizedDirectories].some((d) => d.startsWith(nestedPrefix));
      if (hasNestedChange) {
        nextExpandedChildrenVersion = (tab.expandedChildrenVersion ?? 0) + 1;
      }

      if (nextLastUpdated === tab.lastUpdated && nextExpandedChildrenVersion === tab.expandedChildrenVersion) {
        return tab;
      }

      return {
        ...tab,
        lastUpdated: nextLastUpdated,
        expandedChildrenVersion: nextExpandedChildrenVersion,
      };
    });

    if (nextPanel !== panel) {
      nextPanels[panelId === "left" ? "leftPanel" : "rightPanel"] = nextPanel;
      changed = true;
    }
  }

  if (changed && typeof setState === "function") {
    setState(nextPanels);
  }
};

export const refreshPanelsForEntryPaths = (paths: string[]) => {
  const normalizedPaths = paths.filter((path) => path.length > 0);

  if (normalizedPaths.length === 0) {
    return;
  }

  const state = usePanelStore.getState();
  state.invalidateEntrySizes(paths);

  const now = Date.now();
  let changed = false;
  const nextPanels = {} as Partial<Record<`${PanelId}Panel`, PanelState>>;
  const setState = Reflect.get(usePanelStore, "setState");

  for (const panelId of PANEL_IDS) {
    const panel = panelId === "left" ? state.leftPanel : state.rightPanel;

    const nextPanel = updatePanelTabs(panel, (tab) => {
      const tabPath = coalescePanelPath(tab.resolvedPath, tab.currentPath);

      let nextLastUpdated = tab.lastUpdated;
      let nextExpandedChildrenVersion = tab.expandedChildrenVersion;

      if (normalizedPaths.some((path) => isSameOrNestedPath(tabPath, path))) {
        nextLastUpdated = now;
      }

      const normalizedTabPath = normalizePathForComparison(tabPath);
      const nestedPrefix = normalizedTabPath.endsWith("/")
        ? normalizedTabPath
        : `${normalizedTabPath}/`;
      if (normalizedPaths.some((path) => normalizePathForComparison(path).startsWith(nestedPrefix))) {
        nextExpandedChildrenVersion = (tab.expandedChildrenVersion ?? 0) + 1;
      }

      if (nextLastUpdated === tab.lastUpdated && nextExpandedChildrenVersion === tab.expandedChildrenVersion) {
        return tab;
      }

      return {
        ...tab,
        lastUpdated: nextLastUpdated,
        expandedChildrenVersion: nextExpandedChildrenVersion,
      };
    });

    if (nextPanel !== panel) {
      nextPanels[panelId === "left" ? "leftPanel" : "rightPanel"] = nextPanel;
      changed = true;
    }
  }

  if (changed && typeof setState === "function") {
    setState(nextPanels);
  }
};

export const removeDeletedPathsFromVisiblePanels = (paths: string[]) => {
  const normalizedRemovedPaths = new Set(
    paths
      .filter((path) => path.length > 0)
      .map((path) => normalizePathForComparison(path))
  );
  const normalizedParentDirectories = new Set(
    paths
      .map((path) => getPathDirectoryName(path))
      .filter((directory) => directory.length > 0)
      .map((directory) => normalizePathForComparison(directory))
  );

  if (normalizedRemovedPaths.size === 0 || normalizedParentDirectories.size === 0) {
    return;
  }

  const state = usePanelStore.getState();
  let changed = false;
  const nextPanels = {} as Partial<Record<`${PanelId}Panel`, PanelState>>;
  const setState = Reflect.get(usePanelStore, "setState");

  for (const panelId of PANEL_IDS) {
    const panel = panelId === "left" ? state.leftPanel : state.rightPanel;
    const nextPanel = updatePanelTabs(panel, (tab) => {
      const normalizedCurrentPath = getNormalizedPanelPath(
        coalescePanelPath(tab.resolvedPath, tab.currentPath)
      );

      if (!normalizedCurrentPath || !normalizedParentDirectories.has(normalizedCurrentPath)) {
        return tab;
      }

      const nextFiles = tab.files.filter(
        (entry) => !normalizedRemovedPaths.has(normalizePathForComparison(entry.path))
      );
      const nextSelection = Array.from(tab.selectedItems).filter(
        (path) => !normalizedRemovedPaths.has(normalizePathForComparison(path))
      );

      if (nextFiles.length === tab.files.length && nextSelection.length === tab.selectedItems.size) {
        return tab;
      }

      return {
        ...tab,
        files: nextFiles,
        selectedItems: new Set(nextSelection),
      };
    });

    if (nextPanel !== panel) {
      nextPanels[panelId === "left" ? "leftPanel" : "rightPanel"] = nextPanel;
      changed = true;
    }
  }

  if (changed && typeof setState === "function") {
    setState(nextPanels);
  }
};
