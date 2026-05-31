import {
  collectEntrySizeInvalidationPaths,
  getPanelKey,
  invalidateEntrySizesAcrossPanels,
  setPanelFiles,
  sortPanelByField,
  updateEntrySizeAcrossPanels,
  updateEntrySizeStatusAcrossPanels,
} from "./panelStoreReducers";
import { persistPanelUpdate } from "./panelStorePersistence";
import { queuePersistentSizeCacheDelete } from "./directorySizeCachePersistence";
import {
  panelUpdate,
  type PanelStoreActions,
  type PanelStoreSet,
} from "./panelStoreActionTypes";
import {
  buildHydratedSizeCachePatch,
  buildProgressSizeCachePatch,
  buildSizeStatusCachePatch,
  buildStableSizeCachePatch,
  buildStaleCacheInvalidationPatch,
  queueStableSizeCacheWrite,
} from "./panelStoreSizeCacheActions";

type FileActions = Pick<
  PanelStoreActions,
  | "invalidateEntrySizes"
  | "setEntrySizeStatus"
  | "setFiles"
  | "setSort"
  | "updateEntrySize"
  | "updateEntrySizeEstimate"
  | "updateEntrySizeProgress"
  | "hydrateEntrySizesFromCache"
>;

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

  updateEntrySize: (_panel, path, size) => {
    queueStableSizeCacheWrite(path, size, "exact");

    return set((state) => {
      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size,
        "exact"
      );
      const sizePatch = buildStableSizeCachePatch(
        state,
        nextPanels.normalizedPath,
        size,
        "exact"
      );

      if (
        !sizePatch.changed &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...sizePatch.patch,
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    });
  },

  updateEntrySizeEstimate: (_panel, path, size, status) => {
    queueStableSizeCacheWrite(path, size, status);

    return set((state) => {
      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size,
        status
      );
      const sizePatch = buildStableSizeCachePatch(
        state,
        nextPanels.normalizedPath,
        size,
        status
      );

      if (
        !sizePatch.changed &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...sizePatch.patch,
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    });
  },

  updateEntrySizeProgress: (_panel, path, size) =>
    set((state) => {
      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size,
        "calculating"
      );
      const sizePatch = buildProgressSizeCachePatch(
        state,
        nextPanels.normalizedPath,
        size
      );

      if (
        !sizePatch.changed &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...sizePatch.patch,
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
      const statusPatch = buildSizeStatusCachePatch(
        state,
        nextPanels.normalizedPath,
        status
      );

      if (
        !statusPatch.changed &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...statusPatch.patch,
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    }),

  hydrateEntrySizesFromCache: (entries) =>
    set((state) => {
      if (entries.length === 0) {
        return state;
      }

      return buildHydratedSizeCachePatch(state, entries) ?? state;
    }),

  invalidateEntrySizes: (paths) =>
    set((state) => {
      const invalidatedPaths = collectEntrySizeInvalidationPaths(paths);
      queuePersistentSizeCacheDelete(invalidatedPaths);

      const nextState = invalidateEntrySizesAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        state.sizeCache,
        state.sizeStatusCache,
        paths
      );

      const stalePatch = buildStaleCacheInvalidationPatch(state, invalidatedPaths);

      if (!nextState) {
        return stalePatch.changed ? stalePatch.patch : state;
      }

      return {
        ...nextState,
        ...stalePatch.patch,
      };
    }),
});
