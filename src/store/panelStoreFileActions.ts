import {
  getPanelKey,
  setPanelFiles,
  sortPanelByField,
} from "./panelStoreReducers";
import { persistPanelUpdate } from "./panelStorePersistence";
import {
  panelUpdate,
  type PanelStoreActions,
  type PanelStoreSet,
} from "./panelStoreActionTypes";

type FileActions = Pick<PanelStoreActions, "setFiles" | "setSort">;

export const createPanelStoreFileActions = (set: PanelStoreSet): FileActions => ({
  setFiles: (panel, files) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelFiles(
        state[panelKey],
        files,
        state.sizeCache,
        state.sizeStatusCache
      );

      return panelUpdate(panelKey, nextPanelState);
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
});
