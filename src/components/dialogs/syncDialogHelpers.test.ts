import { describe, expect, it } from "vitest";
import type { SyncItem } from "../../types/sync";
import {
  excludeSameSyncItems,
  formatSyncExecutionFailures,
  getStatusLabel,
  selectAllPendingSyncItems,
  updateSyncItemDirection,
} from "./syncDialogHelpers";

const syncItems: SyncItem[] = [
  {
    relPath: "left.txt",
    leftPath: "/left/left.txt",
    rightPath: "/right/left.txt",
    leftKind: "file",
    rightKind: "file",
    status: "LeftNewer",
    direction: "skip",
  },
  {
    relPath: "same.txt",
    leftPath: "/left/same.txt",
    rightPath: "/right/same.txt",
    leftKind: "file",
    rightKind: "file",
    status: "Same",
    direction: "toRight",
  },
];

describe("syncDialogHelpers", () => {
  it("formats sync execution failures with a visible limit", () => {
    expect(
      formatSyncExecutionFailures([
        { relPath: "one.txt", message: "denied" },
        { relPath: "two.txt", message: "missing" },
        { relPath: "three.txt", message: "busy" },
        { relPath: "four.txt", message: "locked" },
      ])
    ).toBe(
      "4 items failed to synchronize: one.txt (denied), two.txt (missing), three.txt (busy), and 1 more."
    );
  });

  it("updates one item direction without mutating the original list", () => {
    const updated = updateSyncItemDirection(syncItems, 0, "toRight");

    expect(updated[0].direction).toBe("toRight");
    expect(syncItems[0].direction).toBe("skip");
  });

  it("selects skipped items and excludes same items", () => {
    expect(selectAllPendingSyncItems(syncItems, "toLeft")).toEqual([
      { ...syncItems[0], direction: "toLeft" },
      syncItems[1],
    ]);
    expect(excludeSameSyncItems(syncItems)).toEqual([
      syncItems[0],
      { ...syncItems[1], direction: "skip" },
    ]);
  });

  it("formats status labels", () => {
    expect(getStatusLabel("LeftOnly")).toBe("Left Only");
    expect(getStatusLabel("Same")).toBe("Same");
  });
});
