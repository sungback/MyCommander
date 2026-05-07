import type { FileEntry, PanelState, SortField } from "../types/file";
import { getPathDirectoryName } from "../utils/path";
import {
  applyCachedSizes,
  normalizePathKey,
  sortEntries,
  syncPanelWithActiveTab,
  updateActiveTab,
  updatePanelEntrySize,
} from "../utils/panelHelpers";

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
