import type { DirectorySizeStatus, FileEntry } from "../../../types/file";

const DEFAULT_ESTIMATE_OPTIONS = { maxDepth: 1, maxEntries: 200 };
const ROOT_ESTIMATE_OPTIONS = { maxDepth: 0, maxEntries: 100 };
const CLOUD_STORAGE_PATH_MARKERS = [
  "cloudstorage",
  "drivefs",
  "dropbox",
  "google drive",
  "icloud drive",
  "iclouddrive",
  "my drive",
  "onedrive",
  "shared drives",
  "공유 드라이브",
  "내 드라이브",
];
const VOLATILE_AUTO_SCAN_PATH_COMPONENTS = ["appdata"];

export const getAutomaticEstimateOptions = (currentPath: string) => {
  const trimmed = currentPath.replace(/[\\/]+$/, "");
  return trimmed === "" || /^[A-Za-z]:$/.test(trimmed)
    ? ROOT_ESTIMATE_OPTIONS
    : DEFAULT_ESTIMATE_OPTIONS;
};

export const isLikelyCloudStoragePath = (path: string) => {
  const normalized = path
    .replace(/[\\/]+/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/")
    .toLowerCase();

  return CLOUD_STORAGE_PATH_MARKERS.some((marker) =>
    normalized.includes(marker.toLowerCase())
  );
};

export const isLikelyVolatileAutoScanPath = (path: string) => {
  if (!path.includes("\\") && !/^[A-Za-z]:[\\/]/.test(path)) {
    return false;
  }

  const components = path
    .replace(/[\\/]+/g, "/")
    .split("/")
    .filter(Boolean)
    .map((component) => component.toLowerCase());

  return VOLATILE_AUTO_SCAN_PATH_COMPONENTS.some((component) =>
    components.includes(component)
  );
};

export const shouldAutoScanExactSizes = (currentPath: string) =>
  getAutomaticEstimateOptions(currentPath) !== ROOT_ESTIMATE_OPTIONS &&
  !isLikelyCloudStoragePath(currentPath) &&
  !isLikelyVolatileAutoScanPath(currentPath);

export const shouldQueueExactBackgroundScan = (
  entry: FileEntry,
  isStale: boolean
) => {
  if (entry.kind !== "directory" || entry.name === "..") {
    return false;
  }

  if (isLikelyCloudStoragePath(entry.path)) {
    return false;
  }

  if (isLikelyVolatileAutoScanPath(entry.path)) {
    return false;
  }

  return entry.sizeStatus === "estimated" || entry.sizeStatus === "partial" || isStale;
};

export const getExactAttemptKey = (entry: FileEntry, isStale: boolean) =>
  [
    entry.path.normalize("NFC"),
    entry.size ?? "",
    entry.sizeStatus ?? "",
    isStale ? "stale" : "fresh",
  ].join("|");

export type ExactBackgroundSizeStatus = Extract<
  DirectorySizeStatus,
  "estimated" | "partial"
>;
