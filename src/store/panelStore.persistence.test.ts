import { afterEach, describe, expect, it, vi } from "vitest";

const PANEL_STATE_STORAGE_KEY = "total-commander:panel-state";
const localStorageMock = (() => {
  const storage = new Map<string, string>();

  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
})();

(globalThis as { window?: { localStorage: typeof localStorageMock } }).window = {
  localStorage: localStorageMock,
};

afterEach(() => {
  localStorageMock.clear();
  vi.resetModules();
});

describe("panelStore persistence", () => {
  it("restores tabs, active tab, and sort state from localStorage", async () => {
    localStorageMock.setItem(
      PANEL_STATE_STORAGE_KEY,
      JSON.stringify({
        activePanel: "right",
        showHiddenFiles: true,
        themePreference: "dark",
        leftPanel: {
          activeTabId: "left-b",
          tabs: [
            {
              id: "left-a",
              currentPath: "/Users/back/Documents",
              history: ["/Users", "/Users/back/Documents"],
              historyIndex: 1,
              sortField: "name",
              sortDirection: "asc",
            },
            {
              id: "left-b",
              currentPath: "/tmp",
              history: ["/", "/tmp"],
              historyIndex: 1,
              sortField: "date",
              sortDirection: "desc",
            },
          ],
        },
        rightPanel: {
          activeTabId: "right-a",
          tabs: [
            {
              id: "right-a",
              currentPath: "/Applications",
              history: [],
              historyIndex: -1,
              sortField: "size",
              sortDirection: "asc",
            },
          ],
        },
      })
    );

    const { usePanelStore } = await import("./panelStore");
    const state = usePanelStore.getState();

    expect(state.activePanel).toBe("right");
    expect(state.showHiddenFiles).toBe(true);
    expect(state.themePreference).toBe("dark");
    expect(state.leftPanel.tabs).toHaveLength(2);
    expect(state.leftPanel.activeTabId).toBe("left-b");
    expect(state.leftPanel.currentPath).toBe("/tmp");
    expect(state.leftPanel.sortField).toBe("date");
    expect(state.leftPanel.sortDirection).toBe("desc");
    expect(state.rightPanel.currentPath).toBe("/Applications");
  });

  it("falls back to legacy persisted path data when tab state is absent", async () => {
    localStorageMock.setItem(
      PANEL_STATE_STORAGE_KEY,
      JSON.stringify({
        leftPath: "/Users/back",
        rightPath: "/tmp",
      })
    );

    const { usePanelStore } = await import("./panelStore");
    const state = usePanelStore.getState();

    expect(state.leftPanel.tabs).toHaveLength(1);
    expect(state.leftPanel.currentPath).toBe("/Users/back");
    expect(state.rightPanel.currentPath).toBe("/tmp");
  });
});
