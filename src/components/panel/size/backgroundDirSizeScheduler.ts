import type { FileEntry } from "../../../types/file";

export const MAX_BACKGROUND_DIR_SIZE_WORKERS = 2;
export const MAX_BACKGROUND_EXACT_WORKERS = 1;
export const MAX_BACKGROUND_CLOUD_WORKERS = 1;

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
  activeCloudCount: number;
  cloudQueue: Array<{ attemptKey: string; path: string }>;
  queuedCloudPaths: Set<string>;
  settledCloudPaths: Set<string>;
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
  activeCloudCount: 0,
  cloudQueue: [],
  queuedCloudPaths: new Set(),
  settledCloudPaths: new Set(),
});

const getEntryAttemptParts = (entry: FileEntry, isStale: boolean) => [
  entry.path.normalize("NFC"),
  entry.size ?? "",
  entry.sizeStatus ?? "",
  isStale ? "stale" : "fresh",
];

export const getExactAttemptKey = (entry: FileEntry, isStale: boolean) =>
  getEntryAttemptParts(entry, isStale).join("|");

export const getCloudAttemptKey = (
  entry: FileEntry,
  isStale: boolean,
  contextPaths: string[]
) =>
  [
    ...getEntryAttemptParts(entry, isStale),
    ...contextPaths.map((path) => path.normalize("NFC")),
  ].join("|");

export const isStaleSizePath =
  (sizeCacheStale: Record<string, boolean>) => (path: string) =>
    Boolean(sizeCacheStale[path.normalize("NFC")]);
