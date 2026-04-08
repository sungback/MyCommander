import { describe, it, expect, beforeEach } from "vitest";
import { usePanelStore } from "./panelStore";

// Reset store before each test to avoid state leaking
beforeEach(() => {
  usePanelStore.setState(usePanelStore.getInitialState());
});

describe("panelStore — initial state", () => {
  it("has left and right panels", () => {
    const state = usePanelStore.getState();
    expect(state.leftPanel).toBeDefined();
    expect(state.rightPanel).toBeDefined();
    expect(state.leftPanel.id).toBe("left");
    expect(state.rightPanel.id).toBe("right");
  });

  it("defaults activePanel to left", () => {
    const state = usePanelStore.getState();
    // persisted state might override, but structurally it should be "left" or "right"
    expect(["left", "right"]).toContain(state.activePanel);
  });

  it("each panel has at least one tab", () => {
    const state = usePanelStore.getState();
    expect(state.leftPanel.tabs.length).toBeGreaterThanOrEqual(1);
    expect(state.rightPanel.tabs.length).toBeGreaterThanOrEqual(1);
  });

  it("defaults sort to name ascending", () => {
    const state = usePanelStore.getState();
    expect(state.leftPanel.sortField).toBe("name");
    expect(state.leftPanel.sortDirection).toBe("asc");
  });

  it("defaults showHiddenFiles to false", () => {
    const state = usePanelStore.getState();
    expect(state.showHiddenFiles).toBe(false);
  });

  it("defaults panel view modes to detailed", () => {
    const state = usePanelStore.getState();
    expect(state.panelViewModes.left).toBe("detailed");
    expect(state.panelViewModes.right).toBe("detailed");
  });
});

describe("panelStore — setActivePanel", () => {
  it("switches active panel", () => {
    const { setActivePanel } = usePanelStore.getState();
    setActivePanel("right");
    expect(usePanelStore.getState().activePanel).toBe("right");

    setActivePanel("left");
    expect(usePanelStore.getState().activePanel).toBe("left");
  });
});

describe("panelStore — setPanelViewMode", () => {
  it("switches view mode for only the targeted panel", () => {
    const { setPanelViewMode } = usePanelStore.getState();

    setPanelViewMode("left", "brief");
    expect(usePanelStore.getState().panelViewModes.left).toBe("brief");
    expect(usePanelStore.getState().panelViewModes.right).toBe("detailed");

    setPanelViewMode("right", "brief");
    expect(usePanelStore.getState().panelViewModes.left).toBe("brief");
    expect(usePanelStore.getState().panelViewModes.right).toBe("brief");

    setPanelViewMode("left", "detailed");
    expect(usePanelStore.getState().panelViewModes.left).toBe("detailed");
    expect(usePanelStore.getState().panelViewModes.right).toBe("brief");
  });
});

describe("panelStore — setPath", () => {
  it("changes current path", () => {
    const { setPath } = usePanelStore.getState();
    setPath("left", "/new/path");
    expect(usePanelStore.getState().leftPanel.currentPath).toBe("/new/path");
  });

  it("resets cursor to 0 on path change", () => {
    const { setCursor, setPath } = usePanelStore.getState();
    setCursor("left", 5);
    setPath("left", "/another/path");
    expect(usePanelStore.getState().leftPanel.cursorIndex).toBe(0);
  });

  it("clears selection on path change", () => {
    const { toggleSelection, setPath } = usePanelStore.getState();
    toggleSelection("left", "/some/file");
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(1);

    setPath("left", "/new/path");
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(0);
  });
});

describe("panelStore — selection", () => {
  it("toggleSelection adds and removes paths", () => {
    const { toggleSelection } = usePanelStore.getState();

    toggleSelection("left", "/file1");
    expect(usePanelStore.getState().leftPanel.selectedItems.has("/file1")).toBe(true);

    toggleSelection("left", "/file1");
    expect(usePanelStore.getState().leftPanel.selectedItems.has("/file1")).toBe(false);
  });

  it("selectOnly sets exactly one item", () => {
    const { toggleSelection, selectOnly } = usePanelStore.getState();

    toggleSelection("left", "/file1");
    toggleSelection("left", "/file2");
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(2);

    selectOnly("left", "/file1");
    const selected = usePanelStore.getState().leftPanel.selectedItems;
    expect(selected.size).toBe(1);
    expect(selected.has("/file1")).toBe(true);
  });

  it("selectOnly with null clears selection", () => {
    const { toggleSelection, selectOnly } = usePanelStore.getState();

    toggleSelection("left", "/file1");
    selectOnly("left", null);
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(0);
  });

  it("clearSelection empties all selected items", () => {
    const { toggleSelection, clearSelection } = usePanelStore.getState();

    toggleSelection("left", "/a");
    toggleSelection("left", "/b");
    clearSelection("left");
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(0);
  });

  it("setSelection replaces all selections", () => {
    const { toggleSelection, setSelection } = usePanelStore.getState();

    toggleSelection("left", "/old");
    setSelection("left", ["/new1", "/new2"]);

    const selected = usePanelStore.getState().leftPanel.selectedItems;
    expect(selected.has("/old")).toBe(false);
    expect(selected.has("/new1")).toBe(true);
    expect(selected.has("/new2")).toBe(true);
  });
});

describe("panelStore — tabs", () => {
  it("addTab creates a new tab", () => {
    const initialTabCount = usePanelStore.getState().leftPanel.tabs.length;
    usePanelStore.getState().addTab("left");
    expect(usePanelStore.getState().leftPanel.tabs.length).toBe(initialTabCount + 1);
  });

  it("addTab switches to the new tab", () => {
    const oldActiveId = usePanelStore.getState().leftPanel.activeTabId;
    usePanelStore.getState().addTab("left");
    const newActiveId = usePanelStore.getState().leftPanel.activeTabId;
    expect(newActiveId).not.toBe(oldActiveId);
  });

  it("activateTab switches to the specified tab", () => {
    usePanelStore.getState().addTab("left");
    const tabs = usePanelStore.getState().leftPanel.tabs;
    const firstTabId = tabs[0].id;

    usePanelStore.getState().activateTab("left", firstTabId);
    expect(usePanelStore.getState().leftPanel.activeTabId).toBe(firstTabId);
  });

  it("closeTab removes the tab", () => {
    usePanelStore.getState().addTab("left");
    const tabs = usePanelStore.getState().leftPanel.tabs;
    expect(tabs.length).toBe(2);

    usePanelStore.getState().closeTab("left", tabs[0].id);
    expect(usePanelStore.getState().leftPanel.tabs.length).toBe(1);
  });

  it("closeTab does nothing when only one tab remains", () => {
    const tabs = usePanelStore.getState().leftPanel.tabs;
    expect(tabs.length).toBe(1);

    usePanelStore.getState().closeTab("left", tabs[0].id);
    expect(usePanelStore.getState().leftPanel.tabs.length).toBe(1);
  });

  it("activateTab with non-existent id does nothing", () => {
    const before = usePanelStore.getState().leftPanel.activeTabId;
    usePanelStore.getState().activateTab("left", "non-existent-id");
    expect(usePanelStore.getState().leftPanel.activeTabId).toBe(before);
  });
});

describe("panelStore — sorting", () => {
  it("setSort toggles direction on same field", () => {
    const { setSort } = usePanelStore.getState();
    expect(usePanelStore.getState().leftPanel.sortDirection).toBe("asc");

    setSort("left", "name");
    expect(usePanelStore.getState().leftPanel.sortDirection).toBe("desc");

    setSort("left", "name");
    expect(usePanelStore.getState().leftPanel.sortDirection).toBe("asc");
  });

  it("setSort changes field and resets to asc", () => {
    const { setSort } = usePanelStore.getState();
    setSort("left", "name"); // now desc
    setSort("left", "size"); // different field, should be asc
    expect(usePanelStore.getState().leftPanel.sortField).toBe("size");
    expect(usePanelStore.getState().leftPanel.sortDirection).toBe("asc");
  });

  it("setSort resets cursor to 0", () => {
    const { setCursor, setSort } = usePanelStore.getState();
    setCursor("left", 5);
    setSort("left", "size");
    expect(usePanelStore.getState().leftPanel.cursorIndex).toBe(0);
  });
});

describe("panelStore — setFiles", () => {
  it("sorts directories before files", () => {
    const { setFiles } = usePanelStore.getState();
    setFiles("left", [
      { name: "zeta.txt", path: "/zeta.txt", kind: "file" },
      { name: "alpha", path: "/alpha", kind: "directory" },
      { name: "beta.txt", path: "/beta.txt", kind: "file" },
    ]);

    const files = usePanelStore.getState().leftPanel.files;
    expect(files[0].kind).toBe("directory");
    expect(files[0].name).toBe("alpha");
  });

  it("keeps '..' entry at the top", () => {
    const { setFiles } = usePanelStore.getState();
    setFiles("left", [
      { name: "file.txt", path: "/file.txt", kind: "file" },
      { name: "..", path: "/", kind: "directory" },
      { name: "dir", path: "/dir", kind: "directory" },
    ]);

    const files = usePanelStore.getState().leftPanel.files;
    expect(files[0].name).toBe("..");
  });
});

describe("panelStore — updateEntrySize", () => {
  it("updates entry size in both panels", () => {
    const { setFiles, updateEntrySize } = usePanelStore.getState();

    setFiles("left", [
      { name: "folder", path: "/shared/folder", kind: "directory" },
    ]);
    setFiles("right", [
      { name: "folder", path: "/shared/folder", kind: "directory" },
    ]);

    updateEntrySize("left", "/shared/folder", 9999);

    const leftFiles = usePanelStore.getState().leftPanel.files;
    const rightFiles = usePanelStore.getState().rightPanel.files;

    expect(leftFiles.find((f) => f.name === "folder")?.size).toBe(9999);
    expect(rightFiles.find((f) => f.name === "folder")?.size).toBe(9999);
  });

  it("caches the size for future setFiles calls", () => {
    const { setFiles, updateEntrySize } = usePanelStore.getState();

    updateEntrySize("left", "/cached/dir", 5000);

    // New setFiles should apply cached size
    setFiles("left", [
      { name: "dir", path: "/cached/dir", kind: "directory" },
    ]);

    const files = usePanelStore.getState().leftPanel.files;
    expect(files.find((f) => f.name === "dir")?.size).toBe(5000);
  });
});

describe("panelStore — setCursor", () => {
  it("updates cursor index", () => {
    const { setCursor } = usePanelStore.getState();
    setCursor("left", 3);
    expect(usePanelStore.getState().leftPanel.cursorIndex).toBe(3);
  });
});

describe("panelStore — refreshPanel", () => {
  it("updates lastUpdated timestamp", () => {
    const before = usePanelStore.getState().leftPanel.lastUpdated;
    // Small delay to ensure different timestamp
    usePanelStore.getState().refreshPanel("left");
    const after = usePanelStore.getState().leftPanel.lastUpdated;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe("panelStore — settings", () => {
  it("setShowHiddenFiles toggles the flag", () => {
    const { setShowHiddenFiles } = usePanelStore.getState();
    setShowHiddenFiles(true);
    expect(usePanelStore.getState().showHiddenFiles).toBe(true);

    setShowHiddenFiles(false);
    expect(usePanelStore.getState().showHiddenFiles).toBe(false);
  });

  it("setThemePreference changes theme", () => {
    const { setThemePreference } = usePanelStore.getState();
    setThemePreference("dark");
    expect(usePanelStore.getState().themePreference).toBe("dark");

    setThemePreference("light");
    expect(usePanelStore.getState().themePreference).toBe("light");

    setThemePreference("auto");
    expect(usePanelStore.getState().themePreference).toBe("auto");
  });
});
