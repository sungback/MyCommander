import { queuePersistentSizeCacheUpsert } from "./directorySizeCachePersistence";
import { normalizePathKey } from "../utils/panelHelpers";
import type { DirectorySizeStatus } from "../types/file";

export const shouldCacheSizeStatus = (status: unknown) =>
  status === "estimated" || status === "partial" || status === "exact";

export const isLikelyHeavySystemPath = (path: string) => {
  const normalized = path
    .replace(/[\\/]+/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();

  return (
    normalized.endsWith("/users") ||
    normalized.endsWith("/windows") ||
    normalized.endsWith("/program files") ||
    normalized.endsWith("/program files (x86)") ||
    normalized.endsWith("/system") ||
    normalized.endsWith("/usr")
  );
};

export const toHydratedStatus = (
  status: Extract<DirectorySizeStatus, "estimated" | "partial" | "exact">,
  isStale: boolean,
  path: string
) => {
  const resolved = isStale && status === "exact" ? "estimated" : status;
  if (resolved === "partial" && isLikelyHeavySystemPath(path)) {
    return "estimated";
  }
  return resolved;
};

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
