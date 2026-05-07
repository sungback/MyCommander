import { describe, expect, it } from "vitest";
import {
  filterNonConflictingSourcePaths,
  getCopyMoveFailureMessage,
  resolveConflictAction,
} from "./copyMoveConflict";

describe("copyMoveConflict", () => {
  it("uses the pending copy action when available", () => {
    expect(
      resolveConflictAction({
        pendingCopy: {
          isMove: true,
          allPaths: ["/pending/file.txt"],
          targetPath: "/pending-target",
        },
        dragCopyRequest: {
          sourcePanelId: "left",
          targetPanelId: "right",
          sourcePaths: ["/drag/file.txt"],
          targetPath: "/drag-target",
        },
        dragCopyTargetPath: "/resolved-drag-target",
      })
    ).toEqual({
      isMove: true,
      sourcePaths: ["/pending/file.txt"],
      targetPath: "/pending-target",
    });
  });

  it("falls back to the drag-copy request when no pending action exists", () => {
    expect(
      resolveConflictAction({
        pendingCopy: null,
        dragCopyRequest: {
          sourcePanelId: "left",
          targetPanelId: "right",
          sourcePaths: ["/drag/file.txt"],
          targetPath: "",
        },
        dragCopyTargetPath: "/resolved-drag-target",
      })
    ).toEqual({
      isMove: false,
      sourcePaths: ["/drag/file.txt"],
      targetPath: "/resolved-drag-target",
    });
  });

  it("returns null when source paths or target path are missing", () => {
    expect(
      resolveConflictAction({
        pendingCopy: null,
        dragCopyRequest: null,
        dragCopyTargetPath: "/target",
      })
    ).toBeNull();
    expect(
      resolveConflictAction({
        pendingCopy: {
          isMove: false,
          allPaths: ["/source/file.txt"],
          targetPath: " ",
        },
        dragCopyRequest: null,
        dragCopyTargetPath: "",
      })
    ).toBeNull();
  });

  it("filters conflicting sources by basename across path separators", () => {
    expect(
      filterNonConflictingSourcePaths(
        ["/source/keep.txt", "/source/drop.txt", "C:\\source\\win.txt"],
        ["drop.txt", "win.txt"]
      )
    ).toEqual(["/source/keep.txt"]);
  });

  it("returns the copy or move fallback error message", () => {
    expect(getCopyMoveFailureMessage(false)).toBe("Failed to copy selected items.");
    expect(getCopyMoveFailureMessage(true)).toBe("Failed to move selected items.");
  });
});
