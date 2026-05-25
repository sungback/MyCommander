import type { DirectorySizeStatus, FileEntry } from "../types/file";

export const DEFAULT_ESTIMATE_OPTIONS = { maxDepth: 1, maxEntries: 200 };
export const ROOT_ESTIMATE_OPTIONS = { maxDepth: 0, maxEntries: 100 };
export const CLOUD_BOUNDED_ESTIMATE_OPTIONS = {
  maxDepth: 4,
  maxEntries: 2000,
};

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

const VOLATILE_AUTO_SCAN_PATH_COMPONENTS = [
  "appdata",
];

const normalizePathForPolicy = (path: string) =>
  path
    .replace(/[\\/]+/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/")
    .toLowerCase();

export const getAutomaticEstimateOptions = (currentPath: string) => {
  const trimmed = currentPath.replace(/[\\/]+$/, "");
  return trimmed === "" || /^[A-Za-z]:$/.test(trimmed)
    ? ROOT_ESTIMATE_OPTIONS
    : DEFAULT_ESTIMATE_OPTIONS;
};

export const isLikelyCloudStoragePath = (path: string) => {
  const normalized = normalizePathForPolicy(path);

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

export const isCloudSizingPath = (
  path: string,
  contextPaths: string[] = []
) => [path, ...contextPaths].some(isLikelyCloudStoragePath);

export const shouldQueueCloudBoundedEstimate = (
  entry: FileEntry,
  isStale: boolean,
  contextPaths: string[] = []
) => {
  if (entry.kind !== "directory" || entry.name === "..") {
    return false;
  }

  if (isLikelyVolatileAutoScanPath(entry.path)) {
    return false;
  }

  if (!isCloudSizingPath(entry.path, contextPaths)) {
    return false;
  }

  return isStale || entry.sizeStatus === "partial";
};

export const getEstimateOptionsForDirectory = (
  path: string,
  contextPaths: string[] = []
) =>
  isCloudSizingPath(path, contextPaths)
    ? CLOUD_BOUNDED_ESTIMATE_OPTIONS
    : DEFAULT_ESTIMATE_OPTIONS;

export const shouldPromoteEstimateToExact = (
  path: string,
  contextPaths: string[],
  isPartial: boolean
) => isCloudSizingPath(path, contextPaths) && !isPartial;

export const isUsefulPersistentDirectorySize = (
  size: number,
  status: Extract<DirectorySizeStatus, "estimated" | "partial" | "exact">
) => !(status === "partial" && size === 0);
