import type { PanelState } from "../types/file";
import { updateActiveTab } from "../utils/panelHelpers";

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

export const setPanelCursor = (
  panelState: PanelState,
  cursorIndex: number
): PanelState =>
  updateActiveTab(panelState, (tab) => ({
    ...tab,
    cursorIndex,
  }));
