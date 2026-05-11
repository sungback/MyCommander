import { describe, it, expect } from "vitest";
import {
  sortEntries,
  syncPanelWithActiveTab,
  updateTab,
  updateActiveTab,
  updatePanelEntrySize,
  defaultPanelState,
  cloneTabState,
} from "./panelHelpers";
import type { FileEntry, PanelState, PanelTabState } from "../types/file";

const makeFile = (name: string, overrides: Partial<FileEntry> = {}): FileEntry => ({
  name,
  path: `/test/${name}`,
  kind: "file",
  size: 100,
  lastModified: 1000,
  ...overrides,
});

const makeDir = (name: string, overrides: Partial<FileEntry> = {}): FileEntry => ({
  name,
  path: `/test/${name}`,
  kind: "directory",
  ...overrides,
});

const makeTab = (overrides: Partial<PanelTabState> = {}): PanelTabState => ({
  id: "tab-test",
  currentPath: "/test",
  resolvedPath: "/test",
  history: [],
  historyIndex: -1,
  files: [],
  selectedItems: new Set(),
  cursorIndex: 0,
  sortField: "name",
  sortDirection: "asc",
  lastUpdated: 1000,
  pendingCursorName: null,
  expandedChildrenVersion: 0,
  ...overrides,
});

describe("sortEntries", () => {
  it("'..' always appears first regardless of other entries", () => {
    const entries = [makeDir("z-dir"), makeFile("a-file"), makeDir(".."), makeFile("m-file")];
    const result = sortEntries(entries, "name", "asc");
    expect(result[0].name).toBe("..");
  });

  it("directories come before files", () => {
    const entries = [makeFile("a.txt"), makeDir("b-dir"), makeFile("c.txt"), makeDir("a-dir")];
    const result = sortEntries(entries, "name", "asc");
    const kinds = result.map((e) => e.kind);
    const firstFileIdx = kinds.indexOf("file");
    const lastDirIdx = kinds.lastIndexOf("directory");
    expect(lastDirIdx).toBeLessThan(firstFileIdx);
  });

  it("sorts by name ascending", () => {
    const entries = [makeFile("charlie"), makeFile("alpha"), makeFile("bravo")];
    const result = sortEntries(entries, "name", "asc");
    expect(result.map((e) => e.name)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("sorts by name descending", () => {
    const entries = [makeFile("alpha"), makeFile("charlie"), makeFile("bravo")];
    const result = sortEntries(entries, "name", "desc");
    expect(result.map((e) => e.name)).toEqual(["charlie", "bravo", "alpha"]);
  });

  it("sorts by size ascending, treating null/undefined as 0", () => {
    const entries = [
      makeFile("big", { size: 500 }),
      makeFile("zero", { size: null }),
      makeFile("small", { size: 50 }),
    ];
    const result = sortEntries(entries, "size", "asc");
    expect(result[0].name).toBe("zero");
    expect(result[1].name).toBe("small");
    expect(result[2].name).toBe("big");
  });

  it("sorts by size descending", () => {
    const entries = [makeFile("small", { size: 10 }), makeFile("big", { size: 1000 })];
    const result = sortEntries(entries, "size", "desc");
    expect(result[0].name).toBe("big");
    expect(result[1].name).toBe("small");
  });

  it("sorts by date ascending", () => {
    const entries = [
      makeFile("newer", { lastModified: 2000 }),
      makeFile("oldest", { lastModified: 500 }),
      makeFile("middle", { lastModified: 1000 }),
    ];
    const result = sortEntries(entries, "date", "asc");
    expect(result.map((e) => e.name)).toEqual(["oldest", "middle", "newer"]);
  });

  it("sorts by date descending", () => {
    const entries = [
      makeFile("older", { lastModified: 500 }),
      makeFile("newer", { lastModified: 2000 }),
    ];
    const result = sortEntries(entries, "date", "desc");
    expect(result[0].name).toBe("newer");
  });

  it("sorts by ext (falls back to name sort)", () => {
    const entries = [makeFile("charlie"), makeFile("alpha"), makeFile("bravo")];
    const asc = sortEntries(entries, "ext", "asc");
    const desc = sortEntries(entries, "ext", "desc");
    expect(asc.map((e) => e.name)).toEqual(["alpha", "bravo", "charlie"]);
    expect(desc.map((e) => e.name)).toEqual(["charlie", "bravo", "alpha"]);
  });
});

describe("updatePanelEntrySize", () => {
  it("returns the original panel when the entry already has the requested size", () => {
    const tab = makeTab({
      files: [makeDir("folder", { size: 123 })],
      sortField: "size",
    });
    const panel = syncPanelWithActiveTab({
      ...defaultPanelState("left", "/test"),
      tabs: [tab],
      activeTabId: tab.id,
    });

    const result = updatePanelEntrySize(panel, "/test/folder", 123);

    expect(result).toBe(panel);
  });
});

describe("syncPanelWithActiveTab", () => {
  it("copies activeTabId tab's values to panel top-level fields", () => {
    const tab = makeTab({
      id: "tab-active",
      currentPath: "/active",
      sortField: "size",
      sortDirection: "desc",
      cursorIndex: 3,
    });
    const panel: PanelState = {
      id: "left",
      tabs: [tab],
      activeTabId: "tab-active",
      currentPath: "/old",
      history: [],
      historyIndex: -1,
      files: [],
      selectedItems: new Set(),
      cursorIndex: 0,
      sortField: "name",
      sortDirection: "asc",
      lastUpdated: 0,
      pendingCursorName: null,
    };
    const result = syncPanelWithActiveTab(panel);
    expect(result.currentPath).toBe("/active");
    expect(result.sortField).toBe("size");
    expect(result.sortDirection).toBe("desc");
    expect(result.cursorIndex).toBe(3);
    expect(result.activeTabId).toBe("tab-active");
  });

  it("uses first tab when activeTabId does not match any tab", () => {
    const tab = makeTab({ id: "tab-first", currentPath: "/first" });
    const panel: PanelState = {
      id: "left",
      tabs: [tab],
      activeTabId: "tab-nonexistent",
      currentPath: "/old",
      history: [],
      historyIndex: -1,
      files: [],
      selectedItems: new Set(),
      cursorIndex: 0,
      sortField: "name",
      sortDirection: "asc",
      lastUpdated: 0,
      pendingCursorName: null,
    };
    const result = syncPanelWithActiveTab(panel);
    expect(result.activeTabId).toBe("tab-first");
    expect(result.currentPath).toBe("/first");
  });

  it("creates a fallback tab when tabs array is empty", () => {
    const panel: PanelState = {
      id: "left",
      tabs: [],
      activeTabId: "",
      currentPath: "",
      history: [],
      historyIndex: -1,
      files: [],
      selectedItems: new Set(),
      cursorIndex: 0,
      sortField: "name",
      sortDirection: "asc",
      lastUpdated: 0,
      pendingCursorName: null,
    };
    const result = syncPanelWithActiveTab(panel);
    expect(result.tabs).toHaveLength(1);
    expect(result.currentPath).toBeTruthy();
  });
});

describe("updateTab", () => {
  it("only modifies the targeted tab and leaves others unchanged", () => {
    const tab1 = makeTab({ id: "tab-1", currentPath: "/one" });
    const tab2 = makeTab({ id: "tab-2", currentPath: "/two" });
    const panel: PanelState = {
      id: "left",
      tabs: [tab1, tab2],
      activeTabId: "tab-1",
      currentPath: "/one",
      history: [],
      historyIndex: -1,
      files: [],
      selectedItems: new Set(),
      cursorIndex: 0,
      sortField: "name",
      sortDirection: "asc",
      lastUpdated: 0,
      pendingCursorName: null,
    };
    const result = updateTab(panel, "tab-2", (t) => ({ ...t, currentPath: "/two-updated" }));
    expect(result.tabs.find((t) => t.id === "tab-1")!.currentPath).toBe("/one");
    expect(result.tabs.find((t) => t.id === "tab-2")!.currentPath).toBe("/two-updated");
  });

  it("syncs panel after updating a tab", () => {
    const tab = makeTab({ id: "tab-1", currentPath: "/original" });
    const panel: PanelState = {
      id: "left",
      tabs: [tab],
      activeTabId: "tab-1",
      currentPath: "/original",
      history: [],
      historyIndex: -1,
      files: [],
      selectedItems: new Set(),
      cursorIndex: 0,
      sortField: "name",
      sortDirection: "asc",
      lastUpdated: 0,
      pendingCursorName: null,
    };
    const result = updateTab(panel, "tab-1", (t) => ({ ...t, currentPath: "/updated" }));
    expect(result.currentPath).toBe("/updated");
  });
});

describe("updateActiveTab", () => {
  it("modifies the active tab", () => {
    const tab = makeTab({ id: "tab-active", currentPath: "/before" });
    const panel: PanelState = {
      id: "left",
      tabs: [tab],
      activeTabId: "tab-active",
      currentPath: "/before",
      history: [],
      historyIndex: -1,
      files: [],
      selectedItems: new Set(),
      cursorIndex: 0,
      sortField: "name",
      sortDirection: "asc",
      lastUpdated: 0,
      pendingCursorName: null,
    };
    const result = updateActiveTab(panel, (t) => ({ ...t, currentPath: "/after" }));
    expect(result.currentPath).toBe("/after");
    expect(result.tabs[0].currentPath).toBe("/after");
  });
});

describe("defaultPanelState", () => {
  it("creates panel with the given id", () => {
    const panel = defaultPanelState("right");
    expect(panel.id).toBe("right");
  });

  it("sets currentPath from provided path", () => {
    const panel = defaultPanelState("left", "/my/path");
    expect(panel.currentPath).toBe("/my/path");
  });

  it("creates a single default tab", () => {
    const panel = defaultPanelState("left");
    expect(panel.tabs).toHaveLength(1);
    expect(panel.activeTabId).toBe(panel.tabs[0].id);
  });
});

describe("cloneTabState", () => {
  it("assigns a new id different from the original", () => {
    const original = makeTab({ id: "tab-original" });
    const cloned = cloneTabState(original);
    expect(cloned.id).not.toBe("tab-original");
  });

  it("resets selectedItems to empty Set", () => {
    const original = makeTab({ selectedItems: new Set(["/a", "/b"]) });
    const cloned = cloneTabState(original);
    expect(cloned.selectedItems.size).toBe(0);
  });

  it("resets cursorIndex to 0", () => {
    const original = makeTab({ cursorIndex: 7 });
    const cloned = cloneTabState(original);
    expect(cloned.cursorIndex).toBe(0);
  });

  it("preserves other fields like currentPath and sortField", () => {
    const original = makeTab({ currentPath: "/keep/this", sortField: "date" });
    const cloned = cloneTabState(original);
    expect(cloned.currentPath).toBe("/keep/this");
    expect(cloned.sortField).toBe("date");
  });
});
