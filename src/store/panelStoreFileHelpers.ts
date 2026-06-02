import { queuePersistentSizeCacheUpsert } from "./directorySizeCachePersistence";
import { normalizePathKey } from "../utils/panelHelpers";
import type { DirectorySizeStatus } from "../types/file";

export const shouldCacheSizeStatus = (status: unknown) =>
  status === "estimated" || status === "partial" || status === "exact";

export const toHydratedStatus = (
  status: Extract<DirectorySizeStatus, "estimated" | "partial" | "exact">,
  isStale: boolean
) => (isStale && status === "exact" ? "estimated" : status);

export const queueStableSizeCacheWrite = (
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
