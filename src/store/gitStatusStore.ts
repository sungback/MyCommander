import { create } from "zustand";

export interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

interface CachedGitStatus {
  data: GitStatus | null;
  timestamp: number;
}

export type GitStatusCacheResult =
  | { hit: true; data: GitStatus | null }
  | { hit: false };

interface GitStatusStore {
  cache: Map<string, CachedGitStatus>;
  failures: Map<string, number>;
  inFlight: Map<string, Promise<GitStatus | null>>;
  setStatus: (path: string, status: GitStatus | null) => void;
  getCachedStatus: (path: string, ttlMs?: number) => GitStatusCacheResult;
  getStatus: (path: string, ttlMs?: number) => GitStatus | null;
  setFailure: (path: string) => void;
  hasFreshFailure: (path: string, ttlMs?: number) => boolean;
  setInFlight: (path: string, request: Promise<GitStatus | null>) => void;
  getInFlight: (path: string) => Promise<GitStatus | null> | null;
  clearInFlight: (path: string, request?: Promise<GitStatus | null>) => void;
  clear: () => void;
}

const TTL_MS = 30 * 1000; // 30 seconds
const FAILURE_TTL_MS = 30 * 1000;

export const useGitStatusStore = create<GitStatusStore>((set, get) => ({
  cache: new Map(),
  failures: new Map(),
  inFlight: new Map(),

  setStatus: (path: string, status: GitStatus | null) => {
    const { cache, failures } = get();
    cache.set(path, { data: status, timestamp: Date.now() });
    failures.delete(path);
    set({ cache: new Map(cache), failures: new Map(failures) });
  },

  getCachedStatus: (path: string, ttlMs = TTL_MS) => {
    const { cache } = get();
    const cached = cache.get(path);

    if (!cached) {
      return { hit: false };
    }

    const age = Date.now() - cached.timestamp;
    if (age > ttlMs) {
      cache.delete(path);
      set({ cache: new Map(cache) });
      return { hit: false };
    }

    return { hit: true, data: cached.data };
  },

  getStatus: (path: string, ttlMs = TTL_MS) => {
    const cached = get().getCachedStatus(path, ttlMs);
    return cached.hit ? cached.data : null;
  },

  setFailure: (path: string) => {
    const { failures } = get();
    failures.set(path, Date.now());
    set({ failures: new Map(failures) });
  },

  hasFreshFailure: (path: string, ttlMs = FAILURE_TTL_MS) => {
    const { failures } = get();
    const failedAt = failures.get(path);

    if (failedAt === undefined) {
      return false;
    }

    if (Date.now() - failedAt > ttlMs) {
      failures.delete(path);
      set({ failures: new Map(failures) });
      return false;
    }

    return true;
  },

  setInFlight: (path: string, request: Promise<GitStatus | null>) => {
    const { inFlight } = get();
    inFlight.set(path, request);
    set({ inFlight: new Map(inFlight) });
  },

  getInFlight: (path: string) => get().inFlight.get(path) ?? null,

  clearInFlight: (path: string, request?: Promise<GitStatus | null>) => {
    const { inFlight } = get();
    if (request && inFlight.get(path) !== request) {
      return;
    }
    inFlight.delete(path);
    set({ inFlight: new Map(inFlight) });
  },

  clear: () => {
    set({ cache: new Map(), failures: new Map(), inFlight: new Map() });
  },
}));
