import { usePanelStore } from "./panelStore";
import type { PanelState, PanelTabState } from "../types/file";
import { syncPanelWithActiveTab } from "../utils/panelHelpers";
import {
  coalescePanelPath,
  getPathDirectoryName,
  isSameOrNestedPath,
  normalizePathForComparison,
} from "../utils/path";

type PanelId = "left" | "right";
type PanelKey = `${PanelId}Panel`;
type PanelStoreSnapshot = ReturnType<typeof usePanelStore.getState>;

const PANEL_IDS: PanelId[] = ["left", "right"];

const getPanelKey = (panelId: PanelId): PanelKey =>
  panelId === "left" ? "leftPanel" : "rightPanel";

const getPanelState = (state: PanelStoreSnapshot, panelId: PanelId): PanelState =>
  panelId === "left" ? state.leftPanel : state.rightPanel;

const getNormalizedPanelPath = (path?: string | null) => {
  if (typeof path !== "string" || path.length === 0) {
    return null;
  }

  return normalizePathForComparison(path);
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

  return changed ? syncPanelWithActiveTab({ ...panelState, tabs }) : panelState;
};

const updateTabsAcrossPanels = (
  state: PanelStoreSnapshot,
  updater: (tab: PanelTabState) => PanelTabState
) => {
  let changed = false;
  const nextPanels = {} as Partial<Record<PanelKey, PanelState>>;

  for (const panelId of PANEL_IDS) {
    const panel = getPanelState(state, panelId);
    const nextPanel = updatePanelTabs(panel, updater);

    if (nextPanel !== panel) {
      nextPanels[getPanelKey(panelId)] = nextPanel;
      changed = true;
    }
  }

  if (changed) {
    usePanelStore.setState(nextPanels);
  }
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
  updateTabsAcrossPanels(state, (tab) => {
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
    const hasNestedChange = [...normalizedDirectories].some((directory) =>
      directory.startsWith(nestedPrefix)
    );
    if (hasNestedChange) {
      nextExpandedChildrenVersion = (tab.expandedChildrenVersion ?? 0) + 1;
    }

    if (
      nextLastUpdated === tab.lastUpdated &&
      nextExpandedChildrenVersion === tab.expandedChildrenVersion
    ) {
      return tab;
    }

    return {
      ...tab,
      lastUpdated: nextLastUpdated,
      expandedChildrenVersion: nextExpandedChildrenVersion,
    };
  });
};

export const refreshPanelsForEntryPaths = (paths: string[]) => {
  const normalizedPaths = paths.filter((path) => path.length > 0);

  if (normalizedPaths.length === 0) {
    return;
  }

  const state = usePanelStore.getState();
  state.invalidateEntrySizes(paths);

  const now = Date.now();
  updateTabsAcrossPanels(state, (tab) => {
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
    if (
      normalizedPaths.some((path) =>
        normalizePathForComparison(path).startsWith(nestedPrefix)
      )
    ) {
      nextExpandedChildrenVersion = (tab.expandedChildrenVersion ?? 0) + 1;
    }

    if (
      nextLastUpdated === tab.lastUpdated &&
      nextExpandedChildrenVersion === tab.expandedChildrenVersion
    ) {
      return tab;
    }

    return {
      ...tab,
      lastUpdated: nextLastUpdated,
      expandedChildrenVersion: nextExpandedChildrenVersion,
    };
  });
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
  updateTabsAcrossPanels(state, (tab) => {
    const normalizedCurrentPath = getNormalizedPanelPath(
      coalescePanelPath(tab.resolvedPath, tab.currentPath)
    );

    if (
      !normalizedCurrentPath ||
      !normalizedParentDirectories.has(normalizedCurrentPath)
    ) {
      return tab;
    }

    const nextFiles = tab.files.filter(
      (entry) => !normalizedRemovedPaths.has(normalizePathForComparison(entry.path))
    );
    const nextSelection = Array.from(tab.selectedItems).filter(
      (path) => !normalizedRemovedPaths.has(normalizePathForComparison(path))
    );

    if (
      nextFiles.length === tab.files.length &&
      nextSelection.length === tab.selectedItems.size
    ) {
      return tab;
    }

    return {
      ...tab,
      files: nextFiles,
      selectedItems: new Set(nextSelection),
    };
  });
};
