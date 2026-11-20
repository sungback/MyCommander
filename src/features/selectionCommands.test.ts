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
