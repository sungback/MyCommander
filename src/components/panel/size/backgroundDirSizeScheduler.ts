export const MAX_BACKGROUND_DIR_SIZE_WORKERS = 2;
export const MAX_BACKGROUND_EXACT_WORKERS = 1;

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
