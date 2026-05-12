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
import {
  queuePersistentSizeCacheDelete,
  queuePersistentSizeCacheUpsert,
} from "./directorySizeCachePersistence";
import {
  panelUpdate,
  type PanelStoreActions,
  type PanelStoreSet,
} from "./panelStoreActionTypes";
import { normalizePathKey } from "../utils/panelHelpers";
import type { DirectorySizeStatus } from "../types/file";

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

const shouldCacheSizeStatus = (status: unknown) =>
  status === "estimated" || status === "partial" || status === "exact";

const toHydratedStatus = (
  status: Extract<DirectorySizeStatus, "estimated" | "partial" | "exact">,
  isStale: boolean
) => (isStale && status === "exact" ? "estimated" : status);

const queueStableSizeCacheWrite = (
  path: string,
  size: number,
  status: Extract<DirectorySizeStatus, "estimated" | "partial" | "exact">
) => {
  const timestamp = Date.now();
  queuePersistentSizeCacheUpsert({
    path: normalizePathKey(path),
    size,
    status,
    scannedAt: timestamp,
    lastUsedAt: timestamp,
  });
};

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
      const cachedSize = state.sizeCache[nextPanels.normalizedPath];
      const cachedStatus = state.sizeStatusCache[nextPanels.normalizedPath];
      const cachedStale = state.sizeCacheStale[nextPanels.normalizedPath];

      if (
        cachedSize === size &&
        cachedStatus === "exact" &&
        !cachedStale &&
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
        ...(cachedStale
          ? {
              sizeCacheStale: {
                ...state.sizeCacheStale,
                [nextPanels.normalizedPath]: false,
              },
            }
          : {}),
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
      const cachedSize = state.sizeCache[nextPanels.normalizedPath];
      const cachedStatus = state.sizeStatusCache[nextPanels.normalizedPath];
      const cachedStale = state.sizeCacheStale[nextPanels.normalizedPath];

      if (
        cachedSize === size &&
        cachedStatus === status &&
        !cachedStale &&
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
        ...(cachedStale
          ? {
              sizeCacheStale: {
                ...state.sizeCacheStale,
                [nextPanels.normalizedPath]: false,
              },
            }
          : {}),
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
