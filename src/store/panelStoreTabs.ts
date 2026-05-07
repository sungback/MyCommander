import type { PanelId, PanelState, ViewMode } from "../types/file";
import { coalescePanelPath } from "../utils/path";
import {
  cloneTabState,
  defaultTabState,
  syncPanelWithActiveTab,
  updateActiveTab,
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
