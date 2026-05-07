import type { PanelState } from "../types/file";
import { coalescePanelPath } from "../utils/path";
import { updateActiveTab } from "../utils/panelHelpers";

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

export const setPanelPendingCursorName = (
  panelState: PanelState,
  name: string | null
): PanelState =>
  updateActiveTab(panelState, (tab) => ({
    ...tab,
    pendingCursorName: name,
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
