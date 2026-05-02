import { create } from "zustand";
import type { PanelId, PanelState } from "../types/file";
import { readPersistedPanelState } from "./persistence";
import {
  persistVisiblePanelState,
  restorePersistedPanelState,
} from "../utils/panelHelpers";
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
import type { PanelViewModes } from "./panelStoreReducers";
import type { AppState } from "./panelStoreTypes";

const getPanelsAfterUpdate = (
  state: AppState,
  panel: PanelId,
  nextPanelState: PanelState
) => ({
  leftPanel: panel === "left" ? nextPanelState : state.leftPanel,
  rightPanel: panel === "right" ? nextPanelState : state.rightPanel,
});

const persistPanelUpdate = (
  state: AppState,
  panel: PanelId,
  nextPanelState: PanelState
) => {
  const { leftPanel, rightPanel } = getPanelsAfterUpdate(
    state,
    panel,
    nextPanelState
  );

  persistVisiblePanelState(
    leftPanel,
    rightPanel,
    state.activePanel,
    state.showHiddenFiles,
    state.themePreference,
    state.panelViewModes
  );
};

export const usePanelStore = create<AppState>((set) => {
  const persistedPanelState = readPersistedPanelState();
  const panelViewModes: PanelViewModes = {
    left: persistedPanelState.leftViewMode ?? persistedPanelState.viewMode ?? "detailed",
    right: persistedPanelState.rightViewMode ?? persistedPanelState.viewMode ?? "detailed",
  };

  return {
    leftPanel: restorePersistedPanelState(
      "left",
      persistedPanelState.leftPanel,
      persistedPanelState.leftPath
    ),
    rightPanel: restorePersistedPanelState(
      "right",
      persistedPanelState.rightPanel,
      persistedPanelState.rightPath
    ),
    sizeCache: {},
    activePanel: persistedPanelState.activePanel ?? "left",
    showHiddenFiles: persistedPanelState.showHiddenFiles ?? false,
    themePreference: persistedPanelState.themePreference ?? "auto",
    panelViewModes,

    swapPanels: () =>
      set((state) => {
        const swappedPanels = swapPanelLocations(
          state.leftPanel,
          state.rightPanel,
          state.panelViewModes
        );

        if (!swappedPanels) return state;

        persistVisiblePanelState(
          swappedPanels.leftPanel,
          swappedPanels.rightPanel,
          state.activePanel,
          state.showHiddenFiles,
          state.themePreference,
          swappedPanels.panelViewModes
        );

        return swappedPanels;
      }),

    setActivePanel: (activePanel) =>
      set((state) => {
        persistVisiblePanelState(
          state.leftPanel,
          state.rightPanel,
          activePanel,
          state.showHiddenFiles,
          state.themePreference,
          state.panelViewModes
        );
        return { activePanel };
      }),

    setShowHiddenFiles: (showHiddenFiles) =>
      set((state) => {
        persistVisiblePanelState(
          state.leftPanel,
          state.rightPanel,
          state.activePanel,
          showHiddenFiles,
          state.themePreference,
          state.panelViewModes
        );
        return { showHiddenFiles };
      }),

    setThemePreference: (themePreference) =>
      set((state) => {
        persistVisiblePanelState(
          state.leftPanel,
          state.rightPanel,
          state.activePanel,
          state.showHiddenFiles,
          themePreference,
          state.panelViewModes
        );
        return { themePreference };
      }),

    setPanelViewMode: (panel, viewMode) =>
      set((state) => {
        const nextPanelViewModes = {
          ...state.panelViewModes,
          [panel]: viewMode,
        };
        persistVisiblePanelState(
          state.leftPanel,
          state.rightPanel,
          state.activePanel,
          state.showHiddenFiles,
          state.themePreference,
          nextPanelViewModes
        );
        return { panelViewModes: nextPanelViewModes };
      }),

    addTab: (panel) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = addTabToPanel(state[panelKey]);

        persistPanelUpdate(state, panel, nextPanelState);

        return {
          [panelKey]: nextPanelState,
        };
      }),

    activateTab: (panel, tabId) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = activatePanelTab(state[panelKey], tabId);
        if (!nextPanelState) {
          return {};
        }

        persistPanelUpdate(state, panel, nextPanelState);

        return {
          [panelKey]: nextPanelState,
        };
      }),

    closeTab: (panel, tabId) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = closePanelTab(state[panelKey], tabId);
        if (!nextPanelState) {
          return {};
        }

        persistPanelUpdate(state, panel, nextPanelState);

        return {
          [panelKey]: nextPanelState,
        };
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

        return {
          [panelKey]: nextPanelState,
        };
      }),

    setResolvedPath: (panel, path) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = setPanelResolvedPath(state[panelKey], path);

        return {
          [panelKey]: nextPanelState,
        };
      }),

    setFiles: (panel, files) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = setPanelFiles(
          state[panelKey],
          files,
          state.sizeCache
        );

        return {
          [panelKey]: nextPanelState,
        };
      }),

    setSelection: (panel, paths) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = setPanelSelection(state[panelKey], paths);

        return {
          [panelKey]: nextPanelState,
        };
      }),

    setPendingCursorName: (panel, name) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = setPanelPendingCursorName(state[panelKey], name);

        return {
          [panelKey]: nextPanelState,
        };
      }),

    toggleSelection: (panel, path) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = togglePanelSelection(state[panelKey], path);

        return {
          [panelKey]: nextPanelState,
        };
      }),

    selectOnly: (panel, path) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = selectOnlyInPanel(state[panelKey], path);

        return {
          [panelKey]: nextPanelState,
        };
      }),

    clearSelection: (panel) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = clearPanelSelection(state[panelKey]);

        return {
          [panelKey]: nextPanelState,
        };
      }),

    setCursor: (panel, cursorIndex) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = setPanelCursor(state[panelKey], cursorIndex);

        return {
          [panelKey]: nextPanelState,
        };
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

        return { [panelKey]: nextPanelState };
      }),

    goForward: (panel) =>
      set((state) => {
        const panelKey = getPanelKey(panel);
        const nextPanelState = navigatePanelHistory(state[panelKey], 1);
        if (!nextPanelState) return state;

        persistPanelUpdate(state, panel, nextPanelState);

        return { [panelKey]: nextPanelState };
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
  };
});
