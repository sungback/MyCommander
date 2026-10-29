import { describe, expect, it } from "vitest";
import type { SyncItem } from "../../../types/sync";
import {
  excludeSameSyncItems,
  formatSyncExecutionFailures,
  getPanelAccessPath,
  getStatusColor,
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

  it("formats status labels for all statuses", () => {
    expect(getStatusLabel("RightOnly")).toBe("Right Only");
    expect(getStatusLabel("LeftNewer")).toBe("Left Newer");
    expect(getStatusLabel("RightNewer")).toBe("Right Newer");
  });

  it("passes through unknown status in getStatusLabel", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getStatusLabel("UnknownStatus" as any)).toBe("UnknownStatus");
  });

  it("returns correct color for each status in getStatusColor", () => {
    expect(getStatusColor("LeftOnly")).toBe("text-blue-400");
    expect(getStatusColor("RightOnly")).toBe("text-green-400");
    expect(getStatusColor("LeftNewer")).toBe("text-yellow-400");
    expect(getStatusColor("RightNewer")).toBe("text-orange-400");
    expect(getStatusColor("Same")).toBe("text-gray-400");
  });

  it("returns default color for unknown status in getStatusColor", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getStatusColor("UnknownStatus" as any)).toBe("text-text-secondary");
  });

  it("formats a single failure correctly", () => {
    expect(
      formatSyncExecutionFailures([{ relPath: "file.txt", message: "error" }])
    ).toBe("1 item failed to synchronize: file.txt (error).");
  });

  it("formats exactly 3 failures without truncation", () => {
    expect(
      formatSyncExecutionFailures([
        { relPath: "a", message: "err" },
        { relPath: "b", message: "err" },
        { relPath: "c", message: "err" },
      ])
    ).toBe("3 items failed to synchronize: a (err), b (err), c (err).");
  });

  it("returns resolvedPath when set in getPanelAccessPath", () => {
    const panel = { currentPath: "/current", resolvedPath: "/resolved" } as unknown as Parameters<typeof getPanelAccessPath>[0];
    expect(getPanelAccessPath(panel)).toBe("/resolved");
  });

  it("falls back to currentPath when resolvedPath is null in getPanelAccessPath", () => {
    const panel = { currentPath: "/current", resolvedPath: null } as unknown as Parameters<typeof getPanelAccessPath>[0];
    expect(getPanelAccessPath(panel)).toBe("/current");
  });
});
