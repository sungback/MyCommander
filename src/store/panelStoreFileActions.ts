import {
  getPanelKey,
  invalidateEntrySizesAcrossPanels,
  setPanelFiles,
  sortPanelByField,
  updateEntrySizeAcrossPanels,
} from "./panelStoreReducers";
import { persistPanelUpdate } from "./panelStorePersistence";
import {
  panelUpdate,
  type PanelStoreActions,
  type PanelStoreSet,
} from "./panelStoreActionTypes";

type FileActions = Pick<
  PanelStoreActions,
  "invalidateEntrySizes" | "setFiles" | "setSort" | "updateEntrySize"
>;

export const createPanelStoreFileActions = (set: PanelStoreSet): FileActions => ({
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

  setSort: (panel, field) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = sortPanelByField(state[panelKey], field);

      persistPanelUpdate(state, panel, nextPanelState);

      return {
        [panelKey]: nextPanelState,
      };
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
