import type {
  DirectorySizeStatus,
  FileEntry,
  PanelState,
  SortField,
} from "../types/file";
import { getPathDirectoryName } from "../utils/path";
import {
  applyCachedSizes,
  normalizePathKey,
  sortEntries,
  syncPanelWithActiveTab,
  updateActiveTab,
  updatePanelEntrySize,
  updatePanelEntrySizeStatus,
} from "../utils/panelHelpers";

export const setPanelFiles = (
  panelState: PanelState,
  files: FileEntry[],
  sizeCache: Record<string, number>,
  sizeStatusCache: Record<string, DirectorySizeStatus>
): PanelState =>
  updateActiveTab(panelState, (tab) => {
    const filesWithCachedSizes = applyCachedSizes(
      files,
      sizeCache,
      sizeStatusCache
    );
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
  size: number,
  status: DirectorySizeStatus = "exact"
) => {
  const normalizedPath = normalizePathKey(path);

  return {
    normalizedPath,
    leftPanel: updatePanelEntrySize(leftPanel, normalizedPath, size, status),
    rightPanel: updatePanelEntrySize(rightPanel, normalizedPath, size, status),
  };
};

export const updateEntrySizeStatusAcrossPanels = (
  leftPanel: PanelState,
  rightPanel: PanelState,
  path: string,
  status: DirectorySizeStatus
) => {
  const normalizedPath = normalizePathKey(path);

  return {
    normalizedPath,
    leftPanel: updatePanelEntrySizeStatus(leftPanel, normalizedPath, status),
    rightPanel: updatePanelEntrySizeStatus(rightPanel, normalizedPath, status),
  };
};

export const invalidateEntrySizesAcrossPanels = (
  leftPanel: PanelState,
  rightPanel: PanelState,
  sizeCache: Record<string, number>,
  sizeStatusCache: Record<string, DirectorySizeStatus>,
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
  let changedSizeStatusCache = false;
  const nextSizeCache = { ...sizeCache };
  const nextSizeStatusCache = { ...sizeStatusCache };

  for (const path of pathsToInvalidate) {
    if (nextSizeCache[path] !== undefined) {
      delete nextSizeCache[path];
      changedSizeCache = true;
    }

    if (nextSizeStatusCache[path] !== undefined) {
      delete nextSizeStatusCache[path];
      changedSizeStatusCache = true;
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
          (entry.size !== undefined || entry.sizeStatus !== undefined)
        ) {
          tabChanged = true;
          panelChanged = true;
          return { ...entry, size: undefined, sizeStatus: undefined };
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
    !changedSizeStatusCache &&
    nextLeftPanel === leftPanel &&
    nextRightPanel === rightPanel
  ) {
    return null;
  }

  return {
    ...(changedSizeCache ? { sizeCache: nextSizeCache } : {}),
    ...(changedSizeStatusCache
      ? { sizeStatusCache: nextSizeStatusCache }
      : {}),
    leftPanel: nextLeftPanel,
    rightPanel: nextRightPanel,
  };
};
