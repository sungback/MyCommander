import { describe, expect, it, vi } from "vitest";
import type { PanelState } from "../../types/file";
import {
  buildCommandPaletteItems,
  filterCommandPaletteItems,
  getCommandSelectionLabel,
  getPrimaryCommandTarget,
  getSelectedCommandPaths,
  moveCommandPaletteSelection,
} from "./commandPaletteActions";

const makePanel = (overrides: Partial<PanelState> = {}): PanelState =>
  ({
    id: "left",
    activeTabId: "tab-1",
    tabs: [],
    currentPath: "/home/user",
    resolvedPath: null,
    files: [
      { name: "..", path: "/home", kind: "directory" },
      { name: "notes.txt", path: "/home/user/notes.txt", kind: "file" },
      { name: "archive.zip", path: "/home/user/archive.zip", kind: "file" },
      { name: "docs", path: "/home/user/docs", kind: "directory" },
    ],
    selectedItems: new Set<string>(),
    cursorIndex: 1,
    history: ["/home/user"],
    historyIndex: 0,
    sortField: "name",
    sortDirection: "asc",
    lastUpdated: 0,
    pendingCursorName: null,
    ...overrides,
  } as PanelState);

const commandActions = {
  calculateFolderSizes: vi.fn(),
  closeApp: vi.fn(),
  copyCurrentPath: vi.fn(),
  copyToClipboard: vi.fn(),
  createZipFromSelection: vi.fn(),
  cutToClipboard: vi.fn(),
  extractZip: vi.fn(),
  openCopy: vi.fn(),
  openDelete: vi.fn(),
  openEditor: vi.fn(),
  openInfo: vi.fn(),
  openJobCenter: vi.fn(),
  openLocation: vi.fn(),
  openMkdir: vi.fn(),
  openMove: vi.fn(),
  openNewFile: vi.fn(),
  openPreview: vi.fn(),
  openRename: vi.fn(),
  openSearch: vi.fn(),
  openSettings: vi.fn(),
  openSync: vi.fn(),
  openTerminal: vi.fn(),
  pasteFromClipboard: vi.fn(),
  swapPanels: vi.fn(),
  syncOtherPanel: vi.fn(),
  toggleHiddenFiles: vi.fn(),
  undoLastFileOperation: vi.fn(),
};

describe("commandPaletteActions", () => {
  it("selects explicit selected paths before cursor fallback", () => {
    const panel = makePanel({
      selectedItems: new Set(["/home/user/docs", "/home/user/archive.zip"]),
      cursorIndex: 1,
    });

    expect(getSelectedCommandPaths(panel)).toEqual([
      "/home/user/docs",
      "/home/user/archive.zip",
    ]);
  });

  it("falls back to the cursor entry when nothing is selected", () => {
    expect(getSelectedCommandPaths(makePanel({ cursorIndex: 1 }))).toEqual([
      "/home/user/notes.txt",
    ]);
  });

  it("ignores the parent directory cursor entry", () => {
    expect(getSelectedCommandPaths(makePanel({ cursorIndex: 0 }))).toEqual([]);
  });

  it("returns a primary target only when one item is selected or cursor fallback is available", () => {
    expect(getPrimaryCommandTarget(makePanel({ cursorIndex: 2 }))?.entry.name).toBe(
      "archive.zip"
    );
    expect(
      getPrimaryCommandTarget(
        makePanel({
          selectedItems: new Set(["/home/user/notes.txt", "/home/user/docs"]),
        })
      )
    ).toBeNull();
  });

  it("builds disabled reasons from the active context", () => {
    const panel = makePanel({ cursorIndex: 0 });
    const items = buildCommandPaletteItems({
      activePanelId: "left",
      activePanel: panel,
      isMac: true,
      selectedPaths: [],
      primaryTarget: null,
      showHiddenFiles: false,
      actions: commandActions,
    });

    expect(items.find((item) => item.id === "copy")?.disabledReason).toBe(
      "No files selected"
    );
    expect(items.find((item) => item.id === "rename")?.disabledReason).toBe(
      "Select one item"
    );
    expect(items.find((item) => item.id === "extract-zip")?.disabledReason).toBe(
      "Select a ZIP archive"
    );
    expect(items.find((item) => item.id === "undo-file-operation")?.disabledReason).toBe(
      "No rename or move to undo"
    );
    expect(items.find((item) => item.id === "calculate-folder-sizes")?.shortcut).toBe(
      "Cmd+L"
    );
  });

  it("enables the file operation undo command when an undo operation exists", () => {
    const items = buildCommandPaletteItems({
      activePanelId: "left",
      activePanel: makePanel(),
      isMac: false,
      selectedPaths: ["/home/user/notes.txt"],
      primaryTarget: getPrimaryCommandTarget(makePanel()),
      showHiddenFiles: false,
      actions: commandActions,
      undoOperation: {
        id: "undo-1",
        kind: "rename",
        entries: [
          {
            originalPath: "/home/user/old.txt",
            currentPath: "/home/user/new.txt",
          },
        ],
        createdAt: 1,
      },
    });

    const undoItem = items.find((item) => item.id === "undo-file-operation");
    expect(undoItem?.disabledReason).toBeUndefined();
    expect(undoItem?.subtitle).toBe("Rename new.txt back to old.txt");
  });

  it("enables ZIP extraction when the primary target is a ZIP file", () => {
    const panel = makePanel({ cursorIndex: 2 });
    const primaryTarget = getPrimaryCommandTarget(panel);
    const items = buildCommandPaletteItems({
      activePanelId: "left",
      activePanel: panel,
      isMac: false,
      selectedPaths: ["/home/user/archive.zip"],
      primaryTarget,
      showHiddenFiles: true,
      actions: commandActions,
    });

    expect(items.find((item) => item.id === "extract-zip")?.disabledReason).toBeUndefined();
    expect(items.find((item) => item.id === "toggle-hidden-files")?.title).toBe(
      "Hide Hidden Files"
    );
  });

  it("filters by title, shortcut, and keywords", () => {
    const items = buildCommandPaletteItems({
      activePanelId: "left",
      activePanel: makePanel(),
      isMac: false,
      selectedPaths: ["/home/user/notes.txt"],
      primaryTarget: getPrimaryCommandTarget(makePanel()),
      showHiddenFiles: false,
      actions: commandActions,
    });

    expect(filterCommandPaletteItems(items, "zip").map((item) => item.id)).toContain(
      "create-zip"
    );
    expect(filterCommandPaletteItems(items, "ctrl shift p")[0].id).toBe(
      "command-palette"
    );
    expect(filterCommandPaletteItems(items, "prefs")[0].id).toBe("settings");
  });

  it("adds recent and frequent location commands", () => {
    const items = buildCommandPaletteItems({
      activePanelId: "left",
      activePanel: makePanel(),
      isMac: false,
      selectedPaths: ["/home/user/notes.txt"],
      primaryTarget: getPrimaryCommandTarget(makePanel()),
      showHiddenFiles: false,
      actions: commandActions,
      locations: [
        {
          path: "/home/user/Projects",
          name: "Projects",
          source: "frequent",
          visitCount: 3,
        },
        {
          path: "/home/user/Downloads",
          name: "Downloads",
          source: "recent",
        },
      ],
    });

    expect(filterCommandPaletteItems(items, "frequent projects")[0]).toEqual(
      expect.objectContaining({
        id: "open-location:/home/user/Projects",
        title: "Open Projects",
      })
    );
    expect(filterCommandPaletteItems(items, "recent downloads")[0]?.id).toBe(
      "open-location:/home/user/Downloads"
    );
  });

  it("wraps selection movement", () => {
    expect(moveCommandPaletteSelection(0, -1, 3)).toBe(2);
    expect(moveCommandPaletteSelection(2, 1, 3)).toBe(0);
    expect(moveCommandPaletteSelection(1, 1, 0)).toBe(0);
  });

  it("formats selection labels", () => {
    expect(getCommandSelectionLabel([])).toBe("No selection");
    expect(getCommandSelectionLabel(["/home/user/notes.txt"])).toBe("notes.txt");
    expect(getCommandSelectionLabel(["/a", "/b", "/c"])).toBe("3 selected");
  });
});
