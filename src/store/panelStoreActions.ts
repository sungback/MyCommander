import type { StateCreator } from "zustand";
import {
  activatePanelTab,
  addTabToPanel,
  bumpPanelExpandedChildrenVersion,
  clearPanelSelection,
  closePanelTab,
  getPanelKey,
  invalidateEntrySizesAcrossPanels,
  navigatePanelHistory,
  refreshPanelState,
  selectOnlyInPanel,
  setPanelCursor,
  setPanelFiles,
  setPanelPath,
  setPanelPendingCursorName,
  setPanelResolvedPath,
  setPanelSelection,
  sortPanelByField,
  swapPanelLocations,
  togglePanelSelection,
  updateEntrySizeAcrossPanels,
} from "./panelStoreReducers";
import {
  persistPanelUpdate,
  persistPanelVisibilityState,
} from "./panelStorePersistence";
import type { AppState } from "./panelStoreTypes";

type PanelStoreSet = Parameters<StateCreator<AppState>>[0];
type PanelStateKey = "leftPanel" | "rightPanel";
type PanelStoreStateKey =
  | PanelStateKey
  | "sizeCache"
  | "activePanel"
  | "showHiddenFiles"
  | "themePreference"
  | "panelViewModes";
type PanelStoreActions = Omit<AppState, PanelStoreStateKey>;

const panelUpdate = (
  panelKey: PanelStateKey,
  nextPanelState: AppState[PanelStateKey]
) => ({ [panelKey]: nextPanelState });

export const createPanelStoreActions = (set: PanelStoreSet): PanelStoreActions => ({
  swapPanels: () =>
    set((state) => {
      const swappedPanels = swapPanelLocations(
        state.leftPanel,
        state.rightPanel,
        state.panelViewModes
      );

      if (!swappedPanels) return state;

      persistPanelVisibilityState(state, swappedPanels);

      return swappedPanels;
    }),

  setActivePanel: (activePanel) =>
    set((state) => {
      persistPanelVisibilityState(state, { activePanel });
      return { activePanel };
    }),

  setShowHiddenFiles: (showHiddenFiles) =>
    set((state) => {
      persistPanelVisibilityState(state, { showHiddenFiles });
      return { showHiddenFiles };
    }),

  setThemePreference: (themePreference) =>
    set((state) => {
      persistPanelVisibilityState(state, { themePreference });
      return { themePreference };
    }),

  setPanelViewMode: (panel, viewMode) =>
    set((state) => {
      const nextPanelViewModes = {
        ...state.panelViewModes,
        [panel]: viewMode,
      };
      persistPanelVisibilityState(state, {
        panelViewModes: nextPanelViewModes,
      });
      return { panelViewModes: nextPanelViewModes };
    }),

  addTab: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = addTabToPanel(state[panelKey]);

      persistPanelUpdate(state, panel, nextPanelState);

      return panelUpdate(panelKey, nextPanelState);
    }),

  activateTab: (panel, tabId) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = activatePanelTab(state[panelKey], tabId);
      if (!nextPanelState) {
        return {};
      }

      persistPanelUpdate(state, panel, nextPanelState);

      return panelUpdate(panelKey, nextPanelState);
    }),

  closeTab: (panel, tabId) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = closePanelTab(state[panelKey], tabId);
      if (!nextPanelState) {
        return {};
      }

      persistPanelUpdate(state, panel, nextPanelState);

      return panelUpdate(panelKey, nextPanelState);
    }),

  setPath: (panel, path, pendingCursorName) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelPath(
        state[panelKey],
        path,
        pendingCursorName
      );

      persistPanelUpdate(state, panel, nextPanelState);

      return panelUpdate(panelKey, nextPanelState);
    }),

  setResolvedPath: (panel, path) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelResolvedPath(state[panelKey], path);

      return panelUpdate(panelKey, nextPanelState);
    }),

  setFiles: (panel, files) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelFiles(
        state[panelKey],
        files,
        state.sizeCache
      );

      return panelUpdate(panelKey, nextPanelState);
    }),

  setSelection: (panel, paths) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelSelection(state[panelKey], paths);

      return panelUpdate(panelKey, nextPanelState);
    }),

  setPendingCursorName: (panel, name) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelPendingCursorName(state[panelKey], name);

      return panelUpdate(panelKey, nextPanelState);
    }),

  toggleSelection: (panel, path) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = togglePanelSelection(state[panelKey], path);

      return panelUpdate(panelKey, nextPanelState);
    }),

  selectOnly: (panel, path) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = selectOnlyInPanel(state[panelKey], path);

      return panelUpdate(panelKey, nextPanelState);
    }),

  clearSelection: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = clearPanelSelection(state[panelKey]);

      return panelUpdate(panelKey, nextPanelState);
    }),

  setCursor: (panel, cursorIndex) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelCursor(state[panelKey], cursorIndex);

      return panelUpdate(panelKey, nextPanelState);
    }),

  refreshPanel: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = refreshPanelState(state[panelKey]);

      return {
        [panelKey]: nextPanelState,
      };
    }),

  bumpExpandedChildrenVersion: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = bumpPanelExpandedChildrenVersion(state[panelKey]);

      return {
        [panelKey]: nextPanelState,
      };
    }),

  setSort: (panel, field) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = sortPanelByField(state[panelKey], field);

      persistPanelUpdate(state, panel, nextPanelState);

      return {
        [panelKey]: nextPanelState,
      };
    }),

  goBack: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = navigatePanelHistory(state[panelKey], -1);
      if (!nextPanelState) return state;

      persistPanelUpdate(state, panel, nextPanelState);

      return panelUpdate(panelKey, nextPanelState);
    }),

  goForward: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = navigatePanelHistory(state[panelKey], 1);
      if (!nextPanelState) return state;

      persistPanelUpdate(state, panel, nextPanelState);

      return panelUpdate(panelKey, nextPanelState);
    }),

  updateEntrySize: (_panel, path, size) =>
    set((state) => {
      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size
      );

      return {
        sizeCache: {
          ...state.sizeCache,
          [nextPanels.normalizedPath]: size,
        },
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    }),

  invalidateEntrySizes: (paths) =>
    set((state) => {
      return (
        invalidateEntrySizesAcrossPanels(
          state.leftPanel,
          state.rightPanel,
          state.sizeCache,
          paths
        ) ?? state
      );
    }),
});
