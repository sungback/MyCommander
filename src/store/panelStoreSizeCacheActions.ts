import {
  queuePersistentSizeCacheUpsert,
} from "./directorySizeCachePersistence";
import { updateEntrySizeAcrossPanels } from "./panelStoreFiles";
import type { AppState } from "./panelStoreTypes";
import type { DirectorySizeStatus } from "../types/file";
import { normalizePathKey } from "../utils/panelHelpers";

export type StableDirectorySizeStatus = Extract<
  DirectorySizeStatus,
  "estimated" | "partial" | "exact"
>;

type SizeCachePatch = Partial<
  Pick<AppState, "sizeCache" | "sizeStatusCache" | "sizeCacheStale">
>;

export type HydratedEntrySize = Parameters<AppState["hydrateEntrySizesFromCache"]>[0][number];

export const shouldCacheSizeStatus = (
  status: unknown
): status is StableDirectorySizeStatus =>
  status === "estimated" || status === "partial" || status === "exact";

export const toHydratedStatus = (
  status: StableDirectorySizeStatus,
  isStale: boolean
) => (isStale && status === "exact" ? "estimated" : status);

export const queueStableSizeCacheWrite = (
  path: string,
  size: number,
  status: StableDirectorySizeStatus
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

export const buildStableSizeCachePatch = (
  state: AppState,
  normalizedPath: string,
  size: number,
  status: StableDirectorySizeStatus
) => {
  const cachedSize = state.sizeCache[normalizedPath];
  const cachedStatus = state.sizeStatusCache[normalizedPath];
  const cachedStale = state.sizeCacheStale[normalizedPath];
  const patch: SizeCachePatch = {};

  if (cachedSize !== size) {
    patch.sizeCache = {
      ...state.sizeCache,
      [normalizedPath]: size,
    };
  }

  if (cachedStatus !== status) {
    patch.sizeStatusCache = {
      ...state.sizeStatusCache,
      [normalizedPath]: status,
    };
  }

  if (cachedStale) {
    patch.sizeCacheStale = {
      ...state.sizeCacheStale,
      [normalizedPath]: false,
    };
  }

  return {
    changed:
      cachedSize !== size || cachedStatus !== status || Boolean(cachedStale),
    patch,
  };
};

export const buildProgressSizeCachePatch = (
  state: AppState,
  normalizedPath: string,
  size: number
) => {
  const cachedSize = state.sizeCache[normalizedPath];

  return {
    changed: cachedSize !== size,
    patch:
      cachedSize === size
        ? {}
        : {
            sizeCache: {
              ...state.sizeCache,
              [normalizedPath]: size,
            },
          },
  };
};

export const buildSizeStatusCachePatch = (
  state: AppState,
  normalizedPath: string,
  status: DirectorySizeStatus
) => {
  const cachedStatus = state.sizeStatusCache[normalizedPath];
  const nextCachedStatus = shouldCacheSizeStatus(status) ? status : cachedStatus;

  return {
    changed: nextCachedStatus !== cachedStatus,
    patch:
      nextCachedStatus === cachedStatus
        ? {}
        : {
            sizeStatusCache: {
              ...state.sizeStatusCache,
              [normalizedPath]: nextCachedStatus,
            },
          },
  };
};

export const buildHydratedSizeCachePatch = (
  state: AppState,
  entries: HydratedEntrySize[]
) => {
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
    return null;
  }

  return {
    ...(changedSizeCache ? { sizeCache: nextSizeCache } : {}),
    ...(changedStatusCache ? { sizeStatusCache: nextStatusCache } : {}),
    ...(changedStaleCache ? { sizeCacheStale: nextStaleCache } : {}),
    leftPanel,
    rightPanel,
  };
};

export const buildStaleCacheInvalidationPatch = (
  state: AppState,
  invalidatedPaths: string[]
) => {
  const nextStaleCache = { ...state.sizeCacheStale };
  let changedStaleCache = false;

  for (const path of invalidatedPaths) {
    if (nextStaleCache[path] !== undefined) {
      delete nextStaleCache[path];
      changedStaleCache = true;
    }
  }

  return {
    changed: changedStaleCache,
    patch: changedStaleCache ? { sizeCacheStale: nextStaleCache } : {},
  };
};
