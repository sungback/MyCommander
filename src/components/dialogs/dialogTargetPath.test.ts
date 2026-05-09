import { describe, expect, it } from "vitest";
import {
  getDragCopyTargetPath,
  getPathBaseName,
  getPanelAccessPath,
  getSelectedItemsText,
  getSelectedPaths,
  resolveTargetPath,
} from "./dialogTargetPath";
import type { PanelState } from "../../types/file";
import type { DragCopyRequest } from "../../store/dialogStore";
import type { ClipboardState } from "../../store/clipboardStore";

const makePanel = (
  currentPath: string,
  resolvedPath?: string
): PanelState =>
  ({
    currentPath,
    resolvedPath: resolvedPath ?? null,
    files: [],
    selectedItems: new Set<string>(),
    cursorIndex: 0,
  } as unknown as PanelState);

describe("getPathBaseName", () => {
  it("returns last segment of unix path", () => {
    expect(getPathBaseName("/home/user/Documents")).toBe("Documents");
  });

  it("returns last segment of windows path", () => {
    expect(getPathBaseName("C:\\Users\\file.txt")).toBe("file.txt");
  });

  it("handles trailing slash", () => {
    expect(getPathBaseName("/home/user/")).toBe("user");
  });

  it("returns empty string for empty input", () => {
    expect(getPathBaseName("")).toBe("");
  });
});

describe("getSelectedItemsText", () => {
  it("returns '0 files' for empty array", () => {
    expect(getSelectedItemsText([])).toBe("0 files");
  });

  it("returns quoted basename for single item", () => {
    expect(getSelectedItemsText(["/a/file.txt"])).toBe('"file.txt"');
  });

  it("returns comma-separated quoted names for 2 items", () => {
    expect(getSelectedItemsText(["/a.txt", "/b.txt"])).toBe('"a.txt", "b.txt"');
  });

  it("returns comma-separated quoted names for 3 items", () => {
    expect(getSelectedItemsText(["/a.txt", "/b.txt", "/c.txt"])).toBe(
      '"a.txt", "b.txt", "c.txt"'
    );
  });

  it("returns first two + 'and N more file(s)' for 4+ items", () => {
    expect(
      getSelectedItemsText(["/a.txt", "/b.txt", "/c.txt", "/d.txt"])
    ).toBe('"a.txt", "b.txt" and 2 more file(s)');
  });
});

describe("getPanelAccessPath", () => {
  it("returns resolvedPath when present", () => {
    const panel = makePanel("/display/path", "/resolved/path");
    expect(getPanelAccessPath(panel)).toBe("/resolved/path");
  });

  it("returns currentPath when resolvedPath is absent", () => {
    const panel = makePanel("/current/path");
    expect(getPanelAccessPath(panel)).toBe("/current/path");
  });
});

describe("getDragCopyTargetPath", () => {
  const left = makePanel("/left/path");
  const right = makePanel("/right/path");

  it("returns empty string when dragCopyRequest is null", () => {
    expect(getDragCopyTargetPath(null, left, right)).toBe("");
  });

  it("returns targetPath when it has content", () => {
    const req: DragCopyRequest = {
      sourcePanelId: "left",
      targetPanelId: "right",
      sourcePaths: ["/left/file.txt"],
      targetPath: "/explicit/target",
    };
    expect(getDragCopyTargetPath(req, left, right)).toBe("/explicit/target");
  });

  it("returns right panel path when targetPath is empty and targetPanelId is 'right'", () => {
    const req: DragCopyRequest = {
      sourcePanelId: "left",
      targetPanelId: "right",
      sourcePaths: ["/left/file.txt"],
      targetPath: "",
    };
    expect(getDragCopyTargetPath(req, left, right)).toBe("/right/path");
  });

  it("returns left panel path when targetPath is empty and targetPanelId is 'left'", () => {
    const req: DragCopyRequest = {
      sourcePanelId: "right",
      targetPanelId: "left",
      sourcePaths: ["/right/file.txt"],
      targetPath: "",
    };
    expect(getDragCopyTargetPath(req, left, right)).toBe("/left/path");
  });
});

describe("getSelectedPaths", () => {
  it("returns dragCopyRequest.sourcePaths when openDialog is 'copy' and dragCopyRequest exists", () => {
    const req: DragCopyRequest = {
      sourcePanelId: "left",
      targetPanelId: "right",
      sourcePaths: ["/a/file.txt", "/a/other.txt"],
      targetPath: "",
    };
    const panel = makePanel("/panel");
    const result = getSelectedPaths({
      openDialog: "copy",
      dragCopyRequest: req,
      isPasteMode: false,
      clipboard: null,
      activePanel: panel,
    });
    expect(result).toEqual(["/a/file.txt", "/a/other.txt"]);
  });

  it("returns clipboard.paths when isPasteMode and clipboard exist", () => {
    const clipboard = { paths: ["/clip/a.txt", "/clip/b.txt"], operation: "copy" } as ClipboardState;
    const panel = makePanel("/panel");
    const result = getSelectedPaths({
      openDialog: "move",
      dragCopyRequest: null,
      isPasteMode: true,
      clipboard,
      activePanel: panel,
    });
    expect(result).toEqual(["/clip/a.txt", "/clip/b.txt"]);
  });

  it("returns selectedItems when they are non-empty", () => {
    const panel = {
      ...makePanel("/panel"),
      selectedItems: new Set(["/panel/a.txt", "/panel/b.txt"]),
    } as unknown as PanelState;
    const result = getSelectedPaths({
      openDialog: "move",
      dragCopyRequest: null,
      isPasteMode: false,
      clipboard: null,
      activePanel: panel,
    });
    expect(result).toEqual(expect.arrayContaining(["/panel/a.txt", "/panel/b.txt"]));
    expect(result).toHaveLength(2);
  });

  it("returns [cursorFile.path] when selectedItems is empty and cursor file exists", () => {
    const panel = {
      currentPath: "/panel",
      resolvedPath: null,
      selectedItems: new Set<string>(),
      cursorIndex: 0,
      files: [{ name: "cursor.txt", path: "/panel/cursor.txt" }],
    } as unknown as PanelState;
    const result = getSelectedPaths({
      openDialog: "move",
      dragCopyRequest: null,
      isPasteMode: false,
      clipboard: null,
      activePanel: panel,
    });
    expect(result).toEqual(["/panel/cursor.txt"]);
  });

  it("returns [] when selectedItems is empty and cursor file is '..'", () => {
    const panel = {
      currentPath: "/panel",
      resolvedPath: null,
      selectedItems: new Set<string>(),
      cursorIndex: 0,
      files: [{ name: "..", path: "/panel/.." }],
    } as unknown as PanelState;
    const result = getSelectedPaths({
      openDialog: "move",
      dragCopyRequest: null,
      isPasteMode: false,
      clipboard: null,
      activePanel: panel,
    });
    expect(result).toEqual([]);
  });
});

describe("resolveTargetPath", () => {
  const active = makePanel("/active");
  const target = makePanel("/target");

  const baseArgs = {
    isPasteMode: false,
    activePanel: active,
    targetPanel: target,
    openDialog: "move" as const,
    dragCopyRequest: null,
    dragCopyTargetPath: "",
  };

  it("returns '' when inputValue is empty", () => {
    expect(resolveTargetPath({ ...baseArgs, inputValue: "  " })).toBe("");
  });

  it("returns absolute inputValue as-is", () => {
    expect(
      resolveTargetPath({ ...baseArgs, inputValue: "/absolute/path" })
    ).toBe("/absolute/path");
  });

  it("joins relative inputValue onto target panel base", () => {
    expect(
      resolveTargetPath({ ...baseArgs, inputValue: "subdir" })
    ).toBe("/target/subdir");
  });

  it("uses activePanel as base when isPasteMode is true", () => {
    expect(
      resolveTargetPath({ ...baseArgs, isPasteMode: true, inputValue: "subdir" })
    ).toBe("/active/subdir");
  });
});
