import {
  clearPanelSelection,
  getPanelKey,
  selectOnlyInPanel,
  setPanelCursor,
  setPanelSelection,
  togglePanelSelection,
} from "./panelStoreReducers";
import {
  panelUpdate,
  type PanelStoreActions,
  type PanelStoreSet,
} from "./panelStoreActionTypes";

type SelectionActions = Pick<
  PanelStoreActions,
  | "clearSelection"
  | "selectOnly"
  | "setCursor"
  | "setSelection"
  | "toggleSelection"
>;

export const createPanelStoreSelectionActions = (
  set: PanelStoreSet
): SelectionActions => ({
  setSelection: (panel, paths) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelSelection(state[panelKey], paths);

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
});
