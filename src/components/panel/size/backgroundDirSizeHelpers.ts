import type { FileEntry } from "../../../types/file";
import {
  isConfirmedSizeStatus,
  isSizeVerifiedThisSession,
} from "../../../store/panelStoreFileHelpers";
import { getPathBelowVerifiedLocalRoot } from "./storageClassification";

export const MAX_BACKGROUND_DIR_SIZE_WORKERS = 2;
export const MAX_BACKGROUND_EXACT_WORKERS = 1;
export const DEFAULT_ESTIMATE_OPTIONS = { maxDepth: 1, maxEntries: 200 };
export const ROOT_ESTIMATE_OPTIONS = { maxDepth: 0, maxEntries: 100 };
export const DEEP_ESTIMATE_OPTIONS = { maxDepth: 3, maxEntries: 1500 };
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
  if (trimmed === "" || /^[A-Za-z]:$/.test(trimmed)) {
    return ROOT_ESTIMATE_OPTIONS;
  }

  const pathLower = trimmed.toLowerCase();
  if (
    pathLower.includes("appdata") ||
    pathLower.endsWith("내 드라이브") ||
    pathLower.endsWith("my drive") ||
    pathLower.includes("cloudstorage") ||
    pathLower.includes("dropbox") ||
    pathLower.includes("onedrive")
  ) {
    return DEEP_ESTIMATE_OPTIONS;
  }

  return DEFAULT_ESTIMATE_OPTIONS;
};

const normalizeForCloudMarkerMatch = (path: string) =>
  path
    .replace(/[\\/]+/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/")
    .toLowerCase();

const hasCloudStorageMarker = (normalizedLowerPath: string) =>
  CLOUD_STORAGE_PATH_MARKERS.some((marker) =>
    normalizedLowerPath.includes(marker.toLowerCase())
  );

/**
 * 클라우드 폴더로 추정되면 true.
 * 이름이 클라우드처럼 보여도 백엔드가 로컬 폴더로 확인한 경로(그 아래 구간에 클라우드 이름이 없는 경우)는 false다.
 */
export const isLikelyCloudStoragePath = (path: string) =>
  hasCloudStorageMarker(
    normalizeForCloudMarkerMatch(getPathBelowVerifiedLocalRoot(path) ?? path)
  );

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

  return (
    normalized.endsWith("/users") ||
    normalized.endsWith("/windows") ||
    normalized.endsWith("/program files") ||
    normalized.endsWith("/program files (x86)") ||
    normalized.endsWith("/system") ||
    normalized.endsWith("/usr")
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

  if (isConfirmedSizeStatus(entry.sizeStatus) && !isSizeVerifiedThisSession(entry.path)) {
    // 영속 캐시에서 복원된 exact 값은 세션당 한 번 백그라운드로 재검증한다.
    return true;
  }

  return entry.sizeStatus === "estimated" || entry.sizeStatus === "partial" || isStale;
};
