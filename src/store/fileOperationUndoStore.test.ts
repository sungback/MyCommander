import { beforeEach, describe, expect, it } from "vitest";
import {
  buildMoveUndoEntries,
  getFileOperationUndoSubtitle,
  useFileOperationUndoStore,
} from "./fileOperationUndoStore";

describe("fileOperationUndoStore", () => {
  beforeEach(() => {
    useFileOperationUndoStore.setState(
      useFileOperationUndoStore.getInitialState()
    );
  });

  it("records the latest successful rename undo operation", () => {
    useFileOperationUndoStore
      .getState()
      .recordRenameUndo("/home/user/old.txt", "/home/user/new.txt");

    const operation = useFileOperationUndoStore.getState().lastOperation;

    expect(operation).toEqual(
      expect.objectContaining({
        kind: "rename",
        entries: [
          {
            originalPath: "/home/user/old.txt",
            currentPath: "/home/user/new.txt",
          },
        ],
      })
    );
    expect(getFileOperationUndoSubtitle(operation)).toBe(
      "Rename new.txt back to old.txt"
    );
  });

  it("ignores no-op rename records", () => {
    useFileOperationUndoStore
      .getState()
      .recordRenameUndo("/home/user/file.txt", "/home/user/file.txt");

    expect(useFileOperationUndoStore.getState().lastOperation).toBeNull();
  });

  it("promotes completed pending move operations to the latest undo operation", () => {
    const entries = buildMoveUndoEntries(
      ["/home/user/a.txt", "/home/user/docs"],
      "/target",
      { targetIsDirectory: true }
    );

    useFileOperationUndoStore.getState().registerPendingMoveUndo("job-1", entries);
    expect(
      useFileOperationUndoStore.getState().pendingMoveOperations["job-1"]
    ).toEqual(expect.objectContaining({ kind: "move", entries }));

    useFileOperationUndoStore.getState().completePendingMoveUndo("job-1");

    const state = useFileOperationUndoStore.getState();
    expect(state.pendingMoveOperations["job-1"]).toBeUndefined();
    expect(state.lastOperation).toEqual(
      expect.objectContaining({ kind: "move", entries })
    );
    expect(getFileOperationUndoSubtitle(state.lastOperation)).toBe(
      "Move 2 items back"
    );
  });

  it("discards failed pending move operations", () => {
    const entries = buildMoveUndoEntries(["/home/user/a.txt"], "/target", {
      targetIsDirectory: true,
    });

    useFileOperationUndoStore.getState().registerPendingMoveUndo("job-1", entries);
    useFileOperationUndoStore.getState().discardPendingMoveUndo("job-1");

    const state = useFileOperationUndoStore.getState();
    expect(state.pendingMoveOperations["job-1"]).toBeUndefined();
    expect(state.lastOperation).toBeNull();
  });

  it("maps directory move destinations by preserving source basenames", () => {
    expect(
      buildMoveUndoEntries(["/home/user/a.txt"], "/target", {
        targetIsDirectory: true,
      })
    ).toEqual([
      {
        originalPath: "/home/user/a.txt",
        currentPath: "/target/a.txt",
      },
    ]);
  });

  it("maps single exact-target move destinations directly", () => {
    expect(
      buildMoveUndoEntries(["/home/user/a.txt"], "/target/renamed.txt", {
        targetIsDirectory: false,
      })
    ).toEqual([
      {
        originalPath: "/home/user/a.txt",
        currentPath: "/target/renamed.txt",
      },
    ]);
  });
});
