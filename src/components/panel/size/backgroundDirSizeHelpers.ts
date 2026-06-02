import type { FileEntry } from "../../../types/file";

export const MAX_BACKGROUND_DIR_SIZE_WORKERS = 2;
export const MAX_BACKGROUND_EXACT_WORKERS = 1;
export const DEFAULT_ESTIMATE_OPTIONS = { maxDepth: 1, maxEntries: 200 };
export const ROOT_ESTIMATE_OPTIONS = { maxDepth: 0, maxEntries: 100 };
export const CLOUD_STORAGE_PATH_MARKERS = [
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
export const VOLATILE_AUTO_SCAN_PATH_COMPONENTS = [
  "appdata",
];

export interface BackgroundSizeScheduler {
  activeCount: number;
  queue: Array<{ path: string }>;
  queuedPaths: Set<string>;
  settledPaths: Set<string>;
  activeExactCount: number;
  exactQueue: Array<{ attemptKey: string; path: string }>;
  queuedExactPaths: Set<string>;
  settledExactPaths: Set<string>;
  activeExactScans: Map<string, string>;
}

export const createScheduler = (): BackgroundSizeScheduler => ({
  activeCount: 0,
  queue: [],
  queuedPaths: new Set(),
  settledPaths: new Set(),
  activeExactCount: 0,
  exactQueue: [],
  queuedExactPaths: new Set(),
  settledExactPaths: new Set(),
  activeExactScans: new Map(),
});

export const getExactAttemptKey = (entry: FileEntry, isStale: boolean) =>
  [
    entry.path.normalize("NFC"),
    entry.size ?? "",
    entry.sizeStatus ?? "",
    isStale ? "stale" : "fresh",
  ].join("|");

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

export const isLikelyHeavySystemPath = (path: string) => {
  const normalized = path
    .replace(/[\\/]+/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();

  const pathWithoutDrive = normalized.replace(/^[a-z]:/, "");

  return (
    pathWithoutDrive === "/users" ||
    pathWithoutDrive === "/windows" ||
    pathWithoutDrive === "/program files" ||
    pathWithoutDrive === "/program files (x86)" ||
    normalized === "/system" ||
    normalized === "/usr"
  );
};

export const shouldAutoScanExactSizes = (currentPath: string) =>
  getAutomaticEstimateOptions(currentPath) !== ROOT_ESTIMATE_OPTIONS &&
  !isLikelyCloudStoragePath(currentPath) &&
  !isLikelyVolatileAutoScanPath(currentPath) &&
  !isLikelyHeavySystemPath(currentPath);

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

  if (isLikelyHeavySystemPath(entry.path)) {
    return false;
  }

  return entry.sizeStatus === "estimated" || entry.sizeStatus === "partial" || isStale;
};
