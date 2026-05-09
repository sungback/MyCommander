import {
  bumpPanelExpandedChildrenVersion,
  getPanelKey,
  navigatePanelHistory,
  refreshPanelState,
  setPanelPath,
  setPanelPendingCursorName,
  setPanelResolvedPath,
} from "./panelStoreReducers";
import { persistPanelUpdate } from "./panelStorePersistence";
import {
  panelUpdate,
  type PanelStoreActions,
  type PanelStoreSet,
} from "./panelStoreActionTypes";
import { useLocationHistoryStore } from "./locationHistoryStore";

type NavigationActions = Pick<
  PanelStoreActions,
  | "bumpExpandedChildrenVersion"
  | "goBack"
  | "goForward"
  | "refreshPanel"
  | "setPath"
  | "setPendingCursorName"
  | "setResolvedPath"
>;

export const createPanelStoreNavigationActions = (
  set: PanelStoreSet
): NavigationActions => ({
  setPath: (panel, path, pendingCursorName) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelPath(
        state[panelKey],
        path,
        pendingCursorName
      );

      persistPanelUpdate(state, panel, nextPanelState);
      useLocationHistoryStore.getState().recordLocation(path);

      return panelUpdate(panelKey, nextPanelState);
    }),

  setResolvedPath: (panel, path) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelResolvedPath(state[panelKey], path);

      return panelUpdate(panelKey, nextPanelState);
    }),

  setPendingCursorName: (panel, name) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelPendingCursorName(state[panelKey], name);

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

  goBack: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = navigatePanelHistory(state[panelKey], -1);
      if (!nextPanelState) return state;

      persistPanelUpdate(state, panel, nextPanelState);
      useLocationHistoryStore
        .getState()
        .recordLocation(nextPanelState.currentPath);

      return panelUpdate(panelKey, nextPanelState);
    }),

  goForward: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = navigatePanelHistory(state[panelKey], 1);
      if (!nextPanelState) return state;

      persistPanelUpdate(state, panel, nextPanelState);
      useLocationHistoryStore
        .getState()
        .recordLocation(nextPanelState.currentPath);

      return panelUpdate(panelKey, nextPanelState);
    }),
});
