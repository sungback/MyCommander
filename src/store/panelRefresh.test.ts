import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  refreshPanelsForDirectories,
  refreshPanelsForEntryPaths,
  removeDeletedPathsFromVisiblePanels,
} from "./panelRefresh";
import { usePanelStore } from "./panelStore";

beforeEach(() => {
  usePanelStore.setState(usePanelStore.getInitialState());
});

describe("panelRefresh", () => {
  it("refreshes both panels when they point to the same directory", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(123456);

    usePanelStore.getState().setPath("left", "/shared");
    usePanelStore.getState().setPath("right", "/shared/");

    refreshPanelsForDirectories(["/shared"]);

    expect(usePanelStore.getState().leftPanel.lastUpdated).toBe(123456);
    expect(usePanelStore.getState().rightPanel.lastUpdated).toBe(123456);

    nowSpy.mockRestore();
  });

  it("refreshes only panels viewing affected directories", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(555);

    usePanelStore.getState().setPath("left", "/left");
    usePanelStore.getState().setPath("right", "/right");

    const rightBefore = usePanelStore.getState().rightPanel.lastUpdated;

    refreshPanelsForDirectories(["/left"]);

    expect(usePanelStore.getState().leftPanel.lastUpdated).toBe(555);
    expect(usePanelStore.getState().rightPanel.lastUpdated).toBe(rightBefore);

    nowSpy.mockRestore();
  });

  it("refreshes panels based on entry parent directories", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(999);

    usePanelStore.getState().setPath("left", "/shared");
    usePanelStore.getState().setPath("right", "/other");

    refreshPanelsForEntryPaths(["/shared/file.txt"]);

    expect(usePanelStore.getState().leftPanel.lastUpdated).toBe(999);
    expect(usePanelStore.getState().rightPanel.lastUpdated).not.toBe(999);

    nowSpy.mockRestore();
  });

  it("refreshes panels when deleted entries are nested under the current directory", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1001);

    usePanelStore.getState().setPath("left", "/shared");
    usePanelStore.getState().setPath("right", "/other");

    refreshPanelsForEntryPaths(["/shared/abc/def"]);

    expect(usePanelStore.getState().leftPanel.lastUpdated).toBe(1001);
    expect(usePanelStore.getState().rightPanel.lastUpdated).not.toBe(1001);

    nowSpy.mockRestore();
  });

  it("refreshes panels when the display path differs from the resolved path", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(777);

    usePanelStore.getState().setPath("left", "/Users/back/Dropbox");
    usePanelStore
      .getState()
      .setResolvedPath("left", "/Users/back/Library/CloudStorage/Dropbox");

    refreshPanelsForDirectories(["/Users/back/Library/CloudStorage/Dropbox"]);

    expect(usePanelStore.getState().leftPanel.lastUpdated).toBe(777);

    nowSpy.mockRestore();
  });

  it("marks inactive tabs for refresh when they point to an affected directory", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(888);
    const inactiveTabId = "left-tab-shared";

    usePanelStore.setState((state) => ({
      ...state,
      leftPanel: {
        ...state.leftPanel,
        activeTabId: state.leftPanel.tabs[0].id,
        currentPath: "/other",
        resolvedPath: "/other",
        tabs: [
          {
            ...state.leftPanel.tabs[0],
            currentPath: "/other",
            resolvedPath: "/other",
            lastUpdated: 1,
          },
          {
            ...state.leftPanel.tabs[0],
            id: inactiveTabId,
            currentPath: "/shared",
            resolvedPath: "/shared",
            lastUpdated: 2,
          },
        ],
      },
    }));

    refreshPanelsForDirectories(["/shared"]);

    const updatedTab = usePanelStore
      .getState()
      .leftPanel.tabs.find((tab) => tab.id === inactiveTabId);

    expect(updatedTab?.lastUpdated).toBe(888);

    nowSpy.mockRestore();
  });

  it("removes deleted entries from visible panels immediately", () => {
    usePanelStore.setState((state) => ({
      ...state,
      leftPanel: {
        ...state.leftPanel,
        currentPath: "/shared",
        resolvedPath: "/shared",
        files: [
          { name: "..", path: "/", kind: "directory" },
          { name: "LargeFolder", path: "/shared/LargeFolder", kind: "directory", size: null },
          { name: "keep.txt", path: "/shared/keep.txt", kind: "file", size: 1 },
        ],
        selectedItems: new Set<string>(["/shared/LargeFolder"]),
        tabs: state.leftPanel.tabs.map((tab) =>
          tab.id === state.leftPanel.activeTabId
            ? {
                ...tab,
                currentPath: "/shared",
                resolvedPath: "/shared",
                files: [
                  { name: "..", path: "/", kind: "directory" },
                  {
                    name: "LargeFolder",
                    path: "/shared/LargeFolder",
                    kind: "directory",
                    size: null,
                  },
                  { name: "keep.txt", path: "/shared/keep.txt", kind: "file", size: 1 },
                ],
                selectedItems: new Set<string>(["/shared/LargeFolder"]),
              }
            : tab
        ),
      },
    }));

    removeDeletedPathsFromVisiblePanels(["/shared/LargeFolder"]);

    expect(usePanelStore.getState().leftPanel.files.map((entry) => entry.path)).toEqual([
      "/",
      "/shared/keep.txt",
    ]);
    expect(Array.from(usePanelStore.getState().leftPanel.selectedItems)).toEqual([]);
  });

  it("removes deleted entries from inactive tabs viewing the same directory", () => {
    const inactiveTabId = "left-tab-shared";

    usePanelStore.setState((state) => ({
      ...state,
      leftPanel: {
        ...state.leftPanel,
        activeTabId: state.leftPanel.tabs[0].id,
        currentPath: "/other",
        resolvedPath: "/other",
        files: [{ name: "..", path: "/", kind: "directory" }],
        selectedItems: new Set<string>(),
        tabs: [
          {
            ...state.leftPanel.tabs[0],
            currentPath: "/other",
            resolvedPath: "/other",
            files: [{ name: "..", path: "/", kind: "directory" }],
            selectedItems: new Set<string>(),
          },
          {
            ...state.leftPanel.tabs[0],
            id: inactiveTabId,
            currentPath: "/shared",
            resolvedPath: "/shared",
            files: [
              { name: "..", path: "/", kind: "directory" },
              {
                name: "input",
                path: "/shared/input",
                kind: "directory",
                size: null,
              },
              { name: "keep.txt", path: "/shared/keep.txt", kind: "file", size: 1 },
            ],
            selectedItems: new Set<string>(["/shared/input"]),
          },
        ],
      },
    }));

    removeDeletedPathsFromVisiblePanels(["/shared/input"]);

    const updatedTab = usePanelStore
      .getState()
      .leftPanel.tabs.find((tab) => tab.id === inactiveTabId);

    expect(updatedTab?.files.map((entry) => entry.path)).toEqual(["/", "/shared/keep.txt"]);
    expect(Array.from(updatedTab?.selectedItems ?? [])).toEqual([]);

    usePanelStore.getState().activateTab("left", inactiveTabId);

    expect(usePanelStore.getState().leftPanel.files.map((entry) => entry.path)).toEqual([
      "/",
      "/shared/keep.txt",
    ]);
  });
});
