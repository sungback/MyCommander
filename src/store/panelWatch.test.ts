import { describe, expect, it } from "vitest";
import { PanelState } from "../types/file";
import { collectWatchDirectories } from "./panelWatch";

const createPanelState = (id: "left" | "right", paths: string[]): PanelState => {
  const tabs = paths.map((currentPath, index) => ({
    id: `${id}-tab-${index}`,
    currentPath,
    resolvedPath: currentPath,
    history: [],
    historyIndex: -1,
    files: [],
    selectedItems: new Set<string>(),
    cursorIndex: 0,
    sortField: "name" as const,
    sortDirection: "asc" as const,
    lastUpdated: 0,
    pendingCursorName: null as string | null,
    expandedChildrenVersion: 0,
  }));

  const activeTab = tabs[0];

  return {
    id,
    tabs,
    activeTabId: activeTab.id,
    currentPath: activeTab.currentPath,
    resolvedPath: activeTab.resolvedPath,
    history: activeTab.history,
    historyIndex: activeTab.historyIndex,
    files: activeTab.files,
    selectedItems: activeTab.selectedItems,
    cursorIndex: activeTab.cursorIndex,
    sortField: activeTab.sortField,
    sortDirection: activeTab.sortDirection,
    lastUpdated: activeTab.lastUpdated,
    pendingCursorName: null,
  };
};

describe("collectWatchDirectories", () => {
  it("collects unique absolute directories from all panel tabs", () => {
    const leftPanel = createPanelState("left", ["/Users/back/Documents", "/Users/back/Downloads"]);
    const rightPanel = createPanelState("right", ["/Users/back/Documents/", "/Users/back/Desktop"]);

    const watched = collectWatchDirectories([leftPanel, rightPanel]);

    expect(watched).toEqual([
      "/Users/back/Documents",
      "/Users/back/Downloads",
      "/Users/back/Desktop",
    ]);
  });

  it("deduplicates equivalent Windows-style paths", () => {
    const leftPanel = createPanelState("left", ["C:\\Users\\back", "D:\\Data"]);
    const rightPanel = createPanelState("right", ["c:/users/back/", "d:/Data/"]);

    const watched = collectWatchDirectories([leftPanel, rightPanel]);

    expect(watched).toEqual(["C:\\Users\\back", "D:\\Data"]);
  });

  it("ignores empty and relative paths", () => {
    const leftPanel = createPanelState("left", ["", "relative/path", "/absolute"]);
    const rightPanel = createPanelState("right", ["./tmp", "C:folder", "D:\\absolute"]);

    const watched = collectWatchDirectories([leftPanel, rightPanel]);

    expect(watched).toEqual(["/absolute", "D:\\absolute"]);
  });

  it("deduplicates by resolved paths when display paths differ", () => {
    const leftPanel = createPanelState("left", ["/Users/back/Dropbox"]);
    leftPanel.tabs[0].resolvedPath = "/Users/back/Library/CloudStorage/Dropbox";
    leftPanel.resolvedPath = "/Users/back/Library/CloudStorage/Dropbox";

    const rightPanel = createPanelState("right", ["/Users/back/Library/CloudStorage/Dropbox"]);

    const watched = collectWatchDirectories([leftPanel, rightPanel]);

    expect(watched).toEqual(["/Users/back/Library/CloudStorage/Dropbox"]);
  });
});
