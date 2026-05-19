import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  flushPersistentSizeCacheWrites,
  __resetPersistentSizeCacheNotificationsForTests,
  loadPersistentSizeCache,
  queuePersistentSizeCacheDelete,
  queuePersistentSizeCacheUpsert,
} from "./directorySizeCachePersistence";
import { useToastStore } from "./toastStore";

const {
  mockDeleteDirSizeCacheEntries,
  mockLoadDirSizeCache,
  mockUpsertDirSizeCacheEntries,
} = vi.hoisted(() => ({
  mockDeleteDirSizeCacheEntries: vi.fn(),
  mockLoadDirSizeCache: vi.fn(),
  mockUpsertDirSizeCacheEntries: vi.fn(),
}));

vi.mock("../hooks/tauriCommands/fileCommands", () => ({
  fileCommands: {
    deleteDirSizeCacheEntries: mockDeleteDirSizeCacheEntries,
    loadDirSizeCache: mockLoadDirSizeCache,
    upsertDirSizeCacheEntries: mockUpsertDirSizeCacheEntries,
  },
}));

const setTauriRuntime = (enabled: boolean) => {
  const target = window as typeof window & { __TAURI_INTERNALS__?: unknown };
  if (enabled) {
    target.__TAURI_INTERNALS__ = {};
  } else {
    delete target.__TAURI_INTERNALS__;
  }
};

describe("directorySizeCachePersistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setTauriRuntime(false);
    __resetPersistentSizeCacheNotificationsForTests();
    useToastStore.getState().clearToasts();
    mockDeleteDirSizeCacheEntries.mockReset();
    mockLoadDirSizeCache.mockReset();
    mockUpsertDirSizeCacheEntries.mockReset();
  });

  it("does not call Tauri commands outside the Tauri runtime", async () => {
    const entries = await loadPersistentSizeCache();
    queuePersistentSizeCacheUpsert({
      path: "/dir",
      size: 1,
      status: "exact",
    });
    await flushPersistentSizeCacheWrites();

    expect(entries).toEqual([]);
    expect(mockLoadDirSizeCache).not.toHaveBeenCalled();
    expect(mockUpsertDirSizeCacheEntries).not.toHaveBeenCalled();
  });

  it("loads persisted cache entries inside the Tauri runtime", async () => {
    setTauriRuntime(true);
    mockLoadDirSizeCache.mockResolvedValue([
      {
        path: "/dir",
        size: 1,
        status: "exact",
        scannedAt: 10,
        lastUsedAt: 10,
        isStale: false,
      },
    ]);

    await expect(loadPersistentSizeCache()).resolves.toEqual([
      {
        path: "/dir",
        size: 1,
        status: "exact",
        scannedAt: 10,
        lastUsedAt: 10,
        isStale: false,
      },
    ]);
  });

  it("coalesces upserts and deletes before flushing", async () => {
    setTauriRuntime(true);
    mockDeleteDirSizeCacheEntries.mockResolvedValue(undefined);
    mockUpsertDirSizeCacheEntries.mockResolvedValue(undefined);

    queuePersistentSizeCacheUpsert({
      path: "/dir",
      size: 1,
      status: "estimated",
    });
    queuePersistentSizeCacheUpsert({
      path: "/dir",
      size: 2,
      status: "exact",
    });
    queuePersistentSizeCacheDelete(["/old"]);

    await flushPersistentSizeCacheWrites();

    expect(mockDeleteDirSizeCacheEntries).toHaveBeenCalledWith(["/old"]);
    expect(mockUpsertDirSizeCacheEntries).toHaveBeenCalledWith([
      {
        path: "/dir",
        size: 2,
        status: "exact",
      },
    ]);
  });

  it("warns once when persisted cache loading fails", async () => {
    setTauriRuntime(true);
    mockLoadDirSizeCache.mockRejectedValue(new Error("cache unavailable"));

    await expect(loadPersistentSizeCache()).resolves.toEqual([]);
    await expect(loadPersistentSizeCache()).resolves.toEqual([]);

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        message: "저장된 폴더 크기 캐시를 불러오지 못했습니다.",
        tone: "warning",
      }),
    ]);
  });

  it("warns once when persisted cache writes fail", async () => {
    setTauriRuntime(true);
    mockUpsertDirSizeCacheEntries.mockRejectedValue(new Error("write failed"));

    queuePersistentSizeCacheUpsert({
      path: "/dir",
      size: 1,
      status: "exact",
    });

    await flushPersistentSizeCacheWrites();

    queuePersistentSizeCacheUpsert({
      path: "/dir",
      size: 2,
      status: "exact",
    });

    await flushPersistentSizeCacheWrites();

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        message: "폴더 크기 캐시를 저장하지 못했습니다.",
        tone: "warning",
      }),
    ]);
  });
});
