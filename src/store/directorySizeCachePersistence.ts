import {
  fileCommands,
  type PersistentDirectorySizeCacheEntry,
  type PersistentDirectorySizeCacheUpdate,
} from "../hooks/tauriCommands/fileCommands";
import { showTransientToast } from "./toastStore";

const PERSIST_DEBOUNCE_MS = 500;

const pendingUpserts = new Map<string, PersistentDirectorySizeCacheUpdate>();
const pendingDeletes = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let loadFailureNotified = false;
let persistFailureNotified = false;

export const __resetPersistentSizeCacheNotificationsForTests = () => {
  loadFailureNotified = false;
  persistFailureNotified = false;
};

const isTauriRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const tauriWindow = window as typeof window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return Boolean(tauriWindow.__TAURI__ || tauriWindow.__TAURI_INTERNALS__);
};

const scheduleFlush = () => {
  if (!isTauriRuntime() || flushTimer !== null) {
    return;
  }

  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushPersistentSizeCacheWrites();
  }, PERSIST_DEBOUNCE_MS);
};

export const loadPersistentSizeCache = async (): Promise<
  PersistentDirectorySizeCacheEntry[]
> => {
  if (!isTauriRuntime()) {
    return [];
  }

  try {
    return await fileCommands.loadDirSizeCache();
  } catch (error) {
    console.error("Failed to load directory size cache:", error);
    if (!loadFailureNotified) {
      loadFailureNotified = true;
      showTransientToast("저장된 폴더 크기 캐시를 불러오지 못했습니다.", {
        tone: "warning",
        durationMs: 2500,
      });
    }
    return [];
  }
};

export const queuePersistentSizeCacheUpsert = (
  entry: PersistentDirectorySizeCacheUpdate
) => {
  if (!isTauriRuntime()) {
    return;
  }

  pendingDeletes.delete(entry.path);
  pendingUpserts.set(entry.path, entry);
  scheduleFlush();
};

export const queuePersistentSizeCacheDelete = (paths: string[]) => {
  if (!isTauriRuntime()) {
    return;
  }

  for (const path of paths) {
    if (!path) {
      continue;
    }

    pendingUpserts.delete(path);
    pendingDeletes.add(path);
  }

  scheduleFlush();
};

export const flushPersistentSizeCacheWrites = async () => {
  if (!isTauriRuntime()) {
    return;
  }

  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  const entries = Array.from(pendingUpserts.values());
  const paths = Array.from(pendingDeletes);
  pendingUpserts.clear();
  pendingDeletes.clear();

  try {
    if (paths.length > 0) {
      await fileCommands.deleteDirSizeCacheEntries(paths);
    }

    if (entries.length > 0) {
      await fileCommands.upsertDirSizeCacheEntries(entries);
    }
  } catch (error) {
    console.error("Failed to persist directory size cache:", error);
    if (!persistFailureNotified) {
      persistFailureNotified = true;
      showTransientToast("폴더 크기 캐시를 저장하지 못했습니다.", {
        tone: "warning",
        durationMs: 2500,
      });
    }
  }
};
