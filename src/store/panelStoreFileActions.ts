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
import { isUsefulPersistentDirectorySize } from "../utils/directorySizePolicy";
import { normalizePathKey } from "../utils/panelHelpers";
import {
  buildProgressSizeCachePatch,
  buildSizeStatusCachePatch,
  buildStableSizeCachePatch,
  buildUnstableSizeCacheRemoval,
  queueStableSizeCacheWrite,
  shouldCacheSizeStatus,
  stableSizeCacheMatches,
  toHydratedStatus,
} from "./panelStoreSizeCache";

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

      if (
        stableSizeCacheMatches(state, nextPanels.normalizedPath, size, "exact") &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...buildStableSizeCachePatch(
          state,
          nextPanels.normalizedPath,
          size,
          "exact"
        ),
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
      if (!isUsefulPersistentDirectorySize(size, status)) {
        const cacheRemoval = buildUnstableSizeCacheRemoval(
          state,
          nextPanels.normalizedPath
        );

        if (
          !cacheRemoval.changed &&
          nextPanels.leftPanel === state.leftPanel &&
          nextPanels.rightPanel === state.rightPanel
        ) {
          return state;
        }

        return {
          ...cacheRemoval.patch,
          leftPanel: nextPanels.leftPanel,
          rightPanel: nextPanels.rightPanel,
        };
      }

      if (
        stableSizeCacheMatches(state, nextPanels.normalizedPath, size, status) &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...buildStableSizeCachePatch(
          state,
          nextPanels.normalizedPath,
          size,
          status
        ),
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

      if (
        state.sizeCache[nextPanels.normalizedPath] === size &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...buildProgressSizeCachePatch(state, nextPanels.normalizedPath, size),
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

      let leftPanel = state.leftPanel;
      let rightPanel = state.rightPanel;
      let changedSizeCache = false;
      let changedStatusCache = false;
      let changedStaleCache = false;
      const nextSizeCache = { ...state.sizeCache };
      const nextStatusCache = { ...state.sizeStatusCache };
      const nextStaleCache = { ...state.sizeCacheStale };

      for (const entry of entries) {
        const normalizedPath = normalizePathKey(entry.path);
        const existingStatus = state.sizeStatusCache[normalizedPath];
        const existingFreshStable =
          shouldCacheSizeStatus(existingStatus) &&
          !state.sizeCacheStale[normalizedPath];

        if (existingFreshStable) {
          continue;
        }

        const status = toHydratedStatus(entry.status, entry.isStale);
        if (!isUsefulPersistentDirectorySize(entry.size, status)) {
          continue;
        }

        const nextPanels = updateEntrySizeAcrossPanels(
          leftPanel,
          rightPanel,
          normalizedPath,
          entry.size,
          status
        );
        leftPanel = nextPanels.leftPanel;
        rightPanel = nextPanels.rightPanel;

        if (nextSizeCache[normalizedPath] !== entry.size) {
          nextSizeCache[normalizedPath] = entry.size;
          changedSizeCache = true;
        }

        if (nextStatusCache[normalizedPath] !== status) {
          nextStatusCache[normalizedPath] = status;
          changedStatusCache = true;
        }

        if (nextStaleCache[normalizedPath] !== entry.isStale) {
          nextStaleCache[normalizedPath] = entry.isStale;
          changedStaleCache = true;
        }
      }

      if (
        !changedSizeCache &&
        !changedStatusCache &&
        !changedStaleCache &&
        leftPanel === state.leftPanel &&
        rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...(changedSizeCache ? { sizeCache: nextSizeCache } : {}),
        ...(changedStatusCache ? { sizeStatusCache: nextStatusCache } : {}),
        ...(changedStaleCache ? { sizeCacheStale: nextStaleCache } : {}),
        leftPanel,
        rightPanel,
      };
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

      const nextStaleCache = { ...state.sizeCacheStale };
      let changedStaleCache = false;
      for (const path of invalidatedPaths) {
        if (nextStaleCache[path] !== undefined) {
          delete nextStaleCache[path];
          changedStaleCache = true;
        }
      }

      if (!nextState) {
        return changedStaleCache ? { sizeCacheStale: nextStaleCache } : state;
      }

      return {
        ...nextState,
        ...(changedStaleCache ? { sizeCacheStale: nextStaleCache } : {}),
      };
    }),
});
