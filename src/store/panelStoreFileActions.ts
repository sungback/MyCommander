import {
  getPanelKey,
  invalidateEntrySizesAcrossPanels,
  setPanelFiles,
  sortPanelByField,
  updateEntrySizeAcrossPanels,
  updateEntrySizeStatusAcrossPanels,
} from "./panelStoreReducers";
import { persistPanelUpdate } from "./panelStorePersistence";
import {
  panelUpdate,
  type PanelStoreActions,
  type PanelStoreSet,
} from "./panelStoreActionTypes";

type FileActions = Pick<
  PanelStoreActions,
  | "invalidateEntrySizes"
  | "setEntrySizeStatus"
  | "setFiles"
  | "setSort"
  | "updateEntrySize"
  | "updateEntrySizeEstimate"
  | "updateEntrySizeProgress"
>;

const shouldCacheSizeStatus = (status: string) =>
  status === "estimated" || status === "partial" || status === "exact";

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

  updateEntrySize: (_panel, path, size) =>
    set((state) => {
      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size,
        "exact"
      );
      const cachedSize = state.sizeCache[nextPanels.normalizedPath];
      const cachedStatus = state.sizeStatusCache[nextPanels.normalizedPath];

      if (
        cachedSize === size &&
        cachedStatus === "exact" &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...(cachedSize === size
          ? {}
          : {
              sizeCache: {
                ...state.sizeCache,
                [nextPanels.normalizedPath]: size,
              },
            }),
        ...(cachedStatus === "exact"
          ? {}
          : {
              sizeStatusCache: {
                ...state.sizeStatusCache,
                [nextPanels.normalizedPath]: "exact",
              },
            }),
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    }),

  updateEntrySizeEstimate: (_panel, path, size, status) =>
    set((state) => {
      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size,
        status
      );
      const cachedSize = state.sizeCache[nextPanels.normalizedPath];
      const cachedStatus = state.sizeStatusCache[nextPanels.normalizedPath];

      if (
        cachedSize === size &&
        cachedStatus === status &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...(cachedSize === size
          ? {}
          : {
              sizeCache: {
                ...state.sizeCache,
                [nextPanels.normalizedPath]: size,
              },
            }),
        ...(cachedStatus === status
          ? {}
          : {
              sizeStatusCache: {
                ...state.sizeStatusCache,
                [nextPanels.normalizedPath]: status,
              },
            }),
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    }),

  updateEntrySizeProgress: (_panel, path, size) =>
    set((state) => {
      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size,
        "calculating"
      );
      const cachedSize = state.sizeCache[nextPanels.normalizedPath];

      if (
        cachedSize === size &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...(cachedSize === size
          ? {}
          : {
              sizeCache: {
                ...state.sizeCache,
                [nextPanels.normalizedPath]: size,
              },
            }),
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    }),

  setEntrySizeStatus: (_panel, path, status) =>
    set((state) => {
      const nextPanels = updateEntrySizeStatusAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        status
      );
      const cachedStatus = state.sizeStatusCache[nextPanels.normalizedPath];
      const nextSizeStatusCache = shouldCacheSizeStatus(status)
        ? {
            ...state.sizeStatusCache,
            [nextPanels.normalizedPath]: status,
          }
        : state.sizeStatusCache;
      const nextCachedStatus = shouldCacheSizeStatus(status)
        ? status
        : cachedStatus;

      if (
        nextCachedStatus === cachedStatus &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...(nextCachedStatus === cachedStatus
          ? {}
          : {
              sizeStatusCache: nextSizeStatusCache,
            }),
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
          state.sizeStatusCache,
          paths
        ) ?? state
      );
    }),
});
