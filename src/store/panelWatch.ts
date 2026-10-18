import { PanelState, PanelTabState } from "../types/file";
import {
  coalescePanelPath,
  isAbsolutePath,
  isSameOrNestedPath,
  normalizePathForComparison,
} from "../utils/path";

/**
 * 패널이 떠난 뒤에도 계속 감시할 최근 경로 수.
 * 감시 중인 경로의 폴더 크기는 변경이 오면 stale이 되므로 다시 와도 재계산 없이 믿을 수 있다.
 */
export const MAX_LINGERING_WATCH_ROOTS = 8;

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
      expandedChildrenVersion: 0,
    },
  ];
};

export const collectWatchDirectories = (panels: PanelState[]): string[] => {
  const uniquePaths = new Map<string, string>();

  for (const panel of panels) {
    for (const tab of getTabsForWatch(panel)) {
      const currentPath = coalescePanelPath(tab.resolvedPath, tab.currentPath).trim();
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

/**
 * 감시 경로 목록을 갱신한다. 지금 패널 경로(`current`)를 앞에 두고, 이전 목록에서 이어 감시할 경로를
 * 최근 순으로 `MAX_LINGERING_WATCH_ROOTS`개까지 남긴다.
 * 다른 감시 경로 안에 들어 있는 경로는 이미 함께 감시되므로 자리를 차지하지 않게 뺀다.
 */
export const updateWatchRoots = (
  previous: string[],
  current: string[],
  maxLingering = MAX_LINGERING_WATCH_ROOTS
): string[] => {
  const lingering: string[] = [];

  for (const path of previous) {
    const isCovered = [...current, ...lingering].some((root) => isSameOrNestedPath(root, path));
    if (isCovered) {
      continue;
    }

    // 이 경로가 이미 남긴 하위 경로를 감싸면 그 하위 경로는 뺀다.
    const nested = lingering.filter((kept) => isSameOrNestedPath(path, kept));
    if (lingering.length - nested.length >= maxLingering) {
      break;
    }

    for (const kept of nested) {
      lingering.splice(lingering.indexOf(kept), 1);
    }
    lingering.push(path);
  }

  return [...current, ...lingering];
};
