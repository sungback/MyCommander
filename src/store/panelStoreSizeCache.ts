import {
  queuePersistentSizeCacheDelete,
  queuePersistentSizeCacheUpsert,
} from "./directorySizeCachePersistence";
import type { AppState } from "./panelStoreTypes";
import type { DirectorySizeStatus } from "../types/file";
import { isUsefulPersistentDirectorySize } from "../utils/directorySizePolicy";
import { normalizePathKey } from "../utils/panelHelpers";

export type StableDirectorySizeStatus = Extract<
  DirectorySizeStatus,
  "estimated" | "partial" | "exact"
>;

type SizeCacheState = Pick<
  AppState,
  "sizeCache" | "sizeStatusCache" | "sizeCacheStale"
>;

export const shouldCacheSizeStatus = (status: unknown) =>
  status === "estimated" || status === "partial" || status === "exact";

export const hasOwnCacheEntry = (
  cache: Record<string, unknown>,
  key: string
) => Object.prototype.hasOwnProperty.call(cache, key);

export const toHydratedStatus = (
  status: StableDirectorySizeStatus,
  isStale: boolean
) => (isStale && status === "exact" ? "estimated" : status);

export const queueStableSizeCacheWrite = (
  path: string,
  size: number,
  status: StableDirectorySizeStatus
) => {
  const normalizedPath = normalizePathKey(path);
  if (!isUsefulPersistentDirectorySize(size, status)) {
    queuePersistentSizeCacheDelete([normalizedPath]);
    return;
  }

  const timestamp = Date.now();
  queuePersistentSizeCacheUpsert({
    path: normalizedPath,
    size,
    status,
    scannedAt: timestamp,
    lastUsedAt: timestamp,
  });
};

export const stableSizeCacheMatches = (
  state: SizeCacheState,
  normalizedPath: string,
  size: number,
  status: StableDirectorySizeStatus
) =>
  state.sizeCache[normalizedPath] === size &&
  state.sizeStatusCache[normalizedPath] === status &&
  !state.sizeCacheStale[normalizedPath];

export const buildStableSizeCachePatch = (
  state: SizeCacheState,
  normalizedPath: string,
  size: number,
  status: StableDirectorySizeStatus
) => {
  const cachedSize = state.sizeCache[normalizedPath];
  const cachedStatus = state.sizeStatusCache[normalizedPath];
  const cachedStale = state.sizeCacheStale[normalizedPath];

  return {
    ...(cachedSize === size
      ? {}
      : {
          sizeCache: {
            ...state.sizeCache,
            [normalizedPath]: size,
          },
        }),
    ...(cachedStatus === status
      ? {}
      : {
          sizeStatusCache: {
            ...state.sizeStatusCache,
            [normalizedPath]: status,
          },
        }),
    ...(cachedStale
      ? {
          sizeCacheStale: {
            ...state.sizeCacheStale,
            [normalizedPath]: false,
          },
        }
      : {}),
  };
};

export const buildProgressSizeCachePatch = (
  state: SizeCacheState,
  normalizedPath: string,
  size: number
) =>
  state.sizeCache[normalizedPath] === size
    ? {}
    : {
        sizeCache: {
          ...state.sizeCache,
          [normalizedPath]: size,
        },
      };

export const buildUnstableSizeCacheRemoval = (
  state: SizeCacheState,
  normalizedPath: string
) => {
  const hasCachedSize = hasOwnCacheEntry(state.sizeCache, normalizedPath);
  const hasCachedStatus = hasOwnCacheEntry(
    state.sizeStatusCache,
    normalizedPath
  );
  const hasCachedStale = hasOwnCacheEntry(state.sizeCacheStale, normalizedPath);

  if (!hasCachedSize && !hasCachedStatus && !hasCachedStale) {
    return {
      changed: false,
      patch: {},
    };
  }

  const nextSizeCache = { ...state.sizeCache };
  const nextStatusCache = { ...state.sizeStatusCache };
  const nextStaleCache = { ...state.sizeCacheStale };
  delete nextSizeCache[normalizedPath];
  delete nextStatusCache[normalizedPath];
  delete nextStaleCache[normalizedPath];

  return {
    changed: true,
    patch: {
      ...(hasCachedSize ? { sizeCache: nextSizeCache } : {}),
      ...(hasCachedStatus ? { sizeStatusCache: nextStatusCache } : {}),
      ...(hasCachedStale ? { sizeCacheStale: nextStaleCache } : {}),
    },
  };
};

export const buildSizeStatusCachePatch = (
  state: SizeCacheState,
  normalizedPath: string,
  status: DirectorySizeStatus
) => {
  const cachedStatus = state.sizeStatusCache[normalizedPath];
  if (!shouldCacheSizeStatus(status) || cachedStatus === status) {
    return {
      changed: false,
      nextCachedStatus: cachedStatus,
      patch: {},
    };
  }

  return {
    changed: true,
    nextCachedStatus: status,
    patch: {
      sizeStatusCache: {
        ...state.sizeStatusCache,
        [normalizedPath]: status,
      },
    },
  };
};
