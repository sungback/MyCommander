import type { PanelState } from "../types/file";
import { updateActiveTab } from "../utils/panelHelpers";
import { matchesWildcard } from "../utils/wildcardMatch";

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

export const invertPanelSelection = (panelState: PanelState): PanelState =>
  updateActiveTab(panelState, (tab) => {
    const selectedItems = new Set<string>();
    for (const file of tab.files) {
      if (file.name !== "..") {
        if (!tab.selectedItems.has(file.path)) {
          selectedItems.add(file.path);
        }
      }
    }
    return {
      ...tab,
      selectedItems,
    };
  });

export const selectByPatternInPanel = (
  panelState: PanelState,
  pattern: string,
  mode: "select" | "unselect" = "select"
): { nextPanelState: PanelState; changedCount: number } => {
  let changedCount = 0;
  const nextPanelState = updateActiveTab(panelState, (tab) => {
    const selectedItems = new Set(tab.selectedItems);
    for (const file of tab.files) {
      if (file.name !== ".." && matchesWildcard(file.name, pattern)) {
        if (mode === "select") {
          if (!selectedItems.has(file.path)) {
            selectedItems.add(file.path);
            changedCount++;
          }
        } else {
          if (selectedItems.has(file.path)) {
            selectedItems.delete(file.path);
            changedCount++;
          }
        }
      }
    }
    return {
      ...tab,
      selectedItems,
    };
  });
  return { nextPanelState, changedCount };
};

export const setPanelCursor = (
  panelState: PanelState,
  cursorIndex: number
): PanelState =>
  updateActiveTab(panelState, (tab) => ({
    ...tab,
    cursorIndex,
  }));
