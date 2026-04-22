import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDirectoryWatch } from "./useDirectoryWatch";
import { usePanelStore } from "../store/panelStore";

const { listenHandlers, mockSyncWatchedDirectories } = vi.hoisted(() => ({
  listenHandlers: new Map<string, (event: { payload: unknown }) => void>(),
  mockSyncWatchedDirectories: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockImplementation(
    async (eventName: string, handler: (event: { payload: unknown }) => void) => {
      listenHandlers.set(eventName, handler);
      return () => {
        listenHandlers.delete(eventName);
      };
    }
  ),
}));

vi.mock("./useFileSystem", () => ({
  useFileSystem: () => ({
    syncWatchedDirectories: mockSyncWatchedDirectories,
  }),
}));

describe("useDirectoryWatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePanelStore.setState(usePanelStore.getInitialState());
    listenHandlers.clear();
    mockSyncWatchedDirectories.mockReset();
    mockSyncWatchedDirectories.mockResolvedValue(undefined);
  });

  it("refreshes a parent panel when a nested file is deleted in an expanded child directory", async () => {
    usePanelStore.getState().setPath("left", "/Users/back/_Dn");
    usePanelStore.getState().setPath("right", "/tmp");

    const beforeRefresh = usePanelStore.getState().leftPanel.lastUpdated;

    renderHook(() => useDirectoryWatch());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      listenHandlers.get("filesystem-changed")?.({
        payload: {
          directories: ["/Users/back/_Dn/_abc"],
          paths: ["/Users/back/_Dn/_abc/hi.ipynb"],
        },
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(121);
      await Promise.resolve();
    });

    expect(usePanelStore.getState().leftPanel.lastUpdated).toBeGreaterThan(beforeRefresh);
  });
});
