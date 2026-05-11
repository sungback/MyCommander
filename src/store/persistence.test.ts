import { describe, it, expect } from "vitest";
import {
  readPersistedPanelState,
  writePersistedPanelState,
  createTabId,
} from "./persistence";

const STORAGE_KEY = "total-commander:panel-state";

describe("createTabId", () => {
  it("starts with 'tab-' prefix", () => {
    expect(createTabId()).toMatch(/^tab-/);
  });

  it("returns different values on successive calls", () => {
    const a = createTabId();
    const b = createTabId();
    expect(a).not.toBe(b);
  });
});

describe("readPersistedPanelState", () => {
  it("returns {} when localStorage is empty", () => {
    expect(readPersistedPanelState()).toEqual({});
  });

  it("parses valid JSON and returns the state", () => {
    const state = { activePanel: "left" as const, leftPath: "/home", showHiddenFiles: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const result = readPersistedPanelState();
    expect(result.activePanel).toBe("left");
    expect(result.leftPath).toBe("/home");
    expect(result.showHiddenFiles).toBe(false);
  });

  it("strips Windows extended-length prefixes from persisted panel paths", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        leftPath: "\\\\?\\C:\\Users\\sam",
        rightPath: "\\\\?\\UNC\\server\\share",
        leftPanel: {
          tabs: [
            {
              id: "tab-1",
              currentPath: "\\\\?\\C:\\Users\\sam\\AppData",
              history: ["C:\\Users\\sam", "\\\\?\\C:\\Users\\sam\\AppData"],
              historyIndex: 1,
              sortField: "name",
              sortDirection: "asc",
            },
          ],
          activeTabId: "tab-1",
        },
      })
    );

    const result = readPersistedPanelState();
    expect(result.leftPath).toBe("C:\\Users\\sam");
    expect(result.rightPath).toBe("\\\\server\\share");
    expect(result.leftPanel!.tabs[0].currentPath).toBe("C:\\Users\\sam\\AppData");
    expect(result.leftPanel!.tabs[0].history).toEqual([
      "C:\\Users\\sam",
      "C:\\Users\\sam\\AppData",
    ]);
  });

  it("returns {} on invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{");
    expect(readPersistedPanelState()).toEqual({});
  });

  it("allows activePanel 'left' and 'right'", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activePanel: "left" }));
    expect(readPersistedPanelState().activePanel).toBe("left");

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activePanel: "right" }));
    expect(readPersistedPanelState().activePanel).toBe("right");
  });

  it("rejects invalid activePanel values", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activePanel: "center" }));
    expect(readPersistedPanelState().activePanel).toBeUndefined();
  });

  it("allows themePreference 'auto', 'light', 'dark'", () => {
    for (const pref of ["auto", "light", "dark"] as const) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ themePreference: pref }));
      expect(readPersistedPanelState().themePreference).toBe(pref);
    }
  });

  it("rejects invalid themePreference", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themePreference: "system" }));
    expect(readPersistedPanelState().themePreference).toBeUndefined();
  });

  it("validates showHiddenFiles as boolean", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showHiddenFiles: true }));
    expect(readPersistedPanelState().showHiddenFiles).toBe(true);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showHiddenFiles: "yes" }));
    expect(readPersistedPanelState().showHiddenFiles).toBeUndefined();
  });

  it("allows viewMode 'brief' and 'detailed', rejects others", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ viewMode: "brief" }));
    expect(readPersistedPanelState().viewMode).toBe("brief");

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ viewMode: "detailed" }));
    expect(readPersistedPanelState().viewMode).toBe("detailed");

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ viewMode: "grid" }));
    expect(readPersistedPanelState().viewMode).toBeUndefined();
  });

  it("validates tab sortField and sortDirection, discards invalid tabs", () => {
    const validTab = {
      id: "tab-1",
      currentPath: "/home",
      history: [],
      historyIndex: -1,
      sortField: "name",
      sortDirection: "asc",
    };
    const invalidTab = {
      id: "tab-2",
      currentPath: "/tmp",
      history: [],
      historyIndex: -1,
      sortField: "invalid-field",
      sortDirection: "up",
    };
    const state = {
      leftPanel: {
        tabs: [validTab, invalidTab],
        activeTabId: "tab-1",
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const result = readPersistedPanelState();
    expect(result.leftPanel).toBeDefined();
    expect(result.leftPanel!.tabs).toHaveLength(2);
    expect(result.leftPanel!.tabs[0].sortField).toBe("name");
    expect(result.leftPanel!.tabs[0].sortDirection).toBe("asc");
    expect(result.leftPanel!.tabs[1].sortField).toBe("name");
    expect(result.leftPanel!.tabs[1].sortDirection).toBe("asc");
  });

  it("returns undefined for leftPanel when tabs array is empty or invalid", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leftPanel: { tabs: [] } }));
    expect(readPersistedPanelState().leftPanel).toBeUndefined();
  });
});

describe("writePersistedPanelState", () => {
  it("stores JSON in localStorage", () => {
    writePersistedPanelState({ activePanel: "right", leftPath: "/tmp" });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.activePanel).toBe("right");
    expect(parsed.leftPath).toBe("/tmp");
  });

  it("round-trips through read correctly", () => {
    const state = {
      activePanel: "left" as const,
      showHiddenFiles: true,
      themePreference: "dark" as const,
      leftPanel: {
        tabs: [
          {
            id: "tab-abc",
            currentPath: "/Users/test",
            history: ["/Users"],
            historyIndex: 0,
            sortField: "size" as const,
            sortDirection: "desc" as const,
          },
        ],
        activeTabId: "tab-abc",
      },
    };
    writePersistedPanelState(state);
    const result = readPersistedPanelState();
    expect(result.activePanel).toBe("left");
    expect(result.showHiddenFiles).toBe(true);
    expect(result.themePreference).toBe("dark");
    expect(result.leftPanel!.tabs[0].currentPath).toBe("/Users/test");
    expect(result.leftPanel!.tabs[0].sortField).toBe("size");
    expect(result.leftPanel!.tabs[0].sortDirection).toBe("desc");
    expect(result.leftPanel!.activeTabId).toBe("tab-abc");
  });
});
