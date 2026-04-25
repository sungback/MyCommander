import { create } from "zustand";

export interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

interface CachedGitStatus {
  data: GitStatus;
  timestamp: number;
}

interface GitStatusStore {
  cache: Map<string, CachedGitStatus>;
  setStatus: (path: string, status: GitStatus) => void;
  getStatus: (path: string, ttlMs?: number) => GitStatus | null;
  clear: () => void;
}

const TTL_MS = 30 * 1000; // 30 seconds

export const useGitStatusStore = create<GitStatusStore>((set, get) => ({
  cache: new Map(),

  setStatus: (path: string, status: GitStatus) => {
    const { cache } = get();
    cache.set(path, { data: status, timestamp: Date.now() });
    set({ cache: new Map(cache) });
  },

  getStatus: (path: string, ttlMs = TTL_MS) => {
    const { cache } = get();
    const cached = cache.get(path);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > ttlMs) {
      cache.delete(path);
      set({ cache: new Map(cache) });
      return null;
    }

    return cached.data;
  },

  clear: () => {
    set({ cache: new Map() });
  },
}));
