import { PanelState, PanelTabState } from "../types/file";
import { isAbsolutePath, normalizePathForComparison } from "../utils/path";

const getTabsForWatch = (panel: PanelState): PanelTabState[] => {
  if (panel.tabs.length > 0) {
    return panel.tabs;
  }

  return [
    {
      id: panel.activeTabId,
      currentPath: panel.currentPath,
      history: [],
      historyIndex: -1,
      files: [],
      selectedItems: new Set(),
      cursorIndex: 0,
      sortField: "name",
      sortDirection: "asc",
      lastUpdated: panel.lastUpdated,
      pendingCursorName: null,
    },
  ];
};

export const collectWatchDirectories = (panels: PanelState[]): string[] => {
  const uniquePaths = new Map<string, string>();

  for (const panel of panels) {
    for (const tab of getTabsForWatch(panel)) {
      const currentPath = (tab.resolvedPath ?? tab.currentPath).trim();
      if (currentPath.length === 0 || !isAbsolutePath(currentPath)) {
        continue;
      }

      const normalizedPath = normalizePathForComparison(currentPath);
      if (!uniquePaths.has(normalizedPath)) {
        uniquePaths.set(normalizedPath, currentPath);
      }
    }
  }

  return [...uniquePaths.values()];
};
