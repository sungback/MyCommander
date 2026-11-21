import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../types/file";

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  setSelection: vi.fn(),
  toast: vi.fn(),
  writeClipboardText: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readTextFile: vi.fn(), writeTextFile: vi.fn() }));
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
vi.mock("../store/panelStore", () => ({
  usePanelStore: { getState: () => mocks.state },
}));
vi.mock("../store/toastStore", () => ({ showTransientToast: mocks.toast }));
vi.mock("../utils/clipboard", () => ({ writeClipboardText: mocks.writeClipboardText }));

import { isSelectionCommandId, resetSavedSelection, runSelectionCommand } from "./selectionCommands";

const file = (name: string, kind: FileEntry["kind"] = "file"): FileEntry => ({
  name,
  path: `/d/${name}`,
  kind,
  size: 1,
});

const setPanel = (files: FileEntry[], selected: string[], cursorIndex: number) => {
  mocks.state = {
    activePanel: "left",
    setSelection: mocks.setSelection,
    leftPanel: { files, selectedItems: new Set(selected), cursorIndex },
    rightPanel: { files: [], selectedItems: new Set(), cursorIndex: 0 },
  };
};

describe("runSelectionCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSavedSelection();
  });

  it("select-same-extension adds to the existing selection", async () => {
    setPanel([file(".."), file("a.png"), file("b.png"), file("c.txt")], ["/d/c.txt"], 1);
    await runSelectionCommand("select-same-extension");
    expect(mocks.setSelection).toHaveBeenCalledWith("left", ["/d/c.txt", "/d/a.png", "/d/b.png"]);
  });

  it("select-same-extension warns when the cursor is on a folder", async () => {
    setPanel([file("dir", "directory")], [], 0);
    await runSelectionCommand("select-same-extension");
    expect(mocks.setSelection).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.any(String), { tone: "error" });
  });

  it("save then restore keeps only paths still in the panel", async () => {
    setPanel([file("a"), file("b")], ["/d/a", "/d/gone"], 0);
    await runSelectionCommand("save-selection");
    setPanel([file("a"), file("b")], [], 0);
    await runSelectionCommand("restore-selection");
    expect(mocks.setSelection).toHaveBeenCalledWith("left", ["/d/a"]);
  });

  it("restore with no matching paths keeps the current selection", async () => {
    setPanel([file("a")], ["/d/a"], 0);
    await runSelectionCommand("save-selection");
    setPanel([file("x"), file("y")], ["/d/x"], 0);
    await runSelectionCommand("restore-selection");
    expect(mocks.setSelection).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.any(String), { tone: "error" });
  });

  it("load from file with no matching lines keeps the current selection", async () => {
    setPanel([file("x")], ["/d/x"], 0);
    vi.mocked(open).mockResolvedValue("/tmp/selection.txt");
    vi.mocked(readTextFile).mockResolvedValue("nothing-here.txt\n");
    await runSelectionCommand("load-selection-from-file");
    expect(mocks.setSelection).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.any(String), { tone: "error" });
  });

  it("load from file selects the matching lines", async () => {
    setPanel([file("x"), file("y")], [], 0);
    vi.mocked(open).mockResolvedValue("/tmp/selection.txt");
    vi.mocked(readTextFile).mockResolvedValue("y\n");
    await runSelectionCommand("load-selection-from-file");
    expect(mocks.setSelection).toHaveBeenCalledWith("left", ["/d/y"]);
  });

  describe("저장한 선택의 영속화", () => {
    const STORAGE_KEY = "mycommander.savedSelection.v1";

    it("save-selection writes the paths to localStorage", async () => {
      setPanel([file("a"), file("b")], ["/d/a", "/d/b"], 0);
      await runSelectionCommand("save-selection");
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual([
        "/d/a",
        "/d/b",
      ]);
    });

    it("restore uses the stored selection when memory is empty (after an app restart)", async () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["/d/b"]));
      setPanel([file("a"), file("b")], [], 0);
      await runSelectionCommand("restore-selection");
      expect(mocks.setSelection).toHaveBeenCalledWith("left", ["/d/b"]);
    });

    it("ignores corrupted or wrongly shaped stored data", async () => {
      setPanel([file("a")], [], 0);
      for (const bad of ["{not json", JSON.stringify({ a: 1 }), JSON.stringify([1, 2])]) {
        window.localStorage.setItem(STORAGE_KEY, bad);
        mocks.toast.mockClear();
        await runSelectionCommand("restore-selection");
        expect(mocks.setSelection).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledWith("저장된 선택이 없습니다.", { tone: "error" });
      }
    });

    it("still restores in this session when localStorage cannot be written", async () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        setPanel([file("a")], ["/d/a"], 0);
        await runSelectionCommand("save-selection");
        setPanel([file("a")], [], 0);
        await runSelectionCommand("restore-selection");
        expect(mocks.setSelection).toHaveBeenCalledWith("left", ["/d/a"]);
      } finally {
        setItem.mockRestore();
      }
    });
  });

  it("restore without a saved selection changes nothing", async () => {
    setPanel([file("a")], [], 0);
    await runSelectionCommand("restore-selection");
    expect(mocks.setSelection).not.toHaveBeenCalled();
  });

  it("copy commands use the cursor item when nothing is selected", async () => {
    setPanel([file("a.txt"), file("b.txt")], [], 1);
    await runSelectionCommand("copy-selected-names");
    expect(mocks.writeClipboardText).toHaveBeenCalledWith("b.txt");
  });

  it("copy commands do nothing for the .. entry", async () => {
    setPanel([file("..", "directory")], [], 0);
    await runSelectionCommand("copy-selected-paths");
    expect(mocks.writeClipboardText).not.toHaveBeenCalled();
  });

  it("validates command ids from the native menu", () => {
    expect(isSelectionCommandId("copy-selected-names")).toBe(true);
    expect(isSelectionCommandId("rm -rf")).toBe(false);
    expect(isSelectionCommandId(undefined)).toBe(false);
  });
});
