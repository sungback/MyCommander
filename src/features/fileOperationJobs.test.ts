import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileOperationUndoStore } from "../store/fileOperationUndoStore";
import {
  buildCopyJob,
  buildZipSelectionJob,
  getUndoRefreshDirectories,
  submitMoveJobWithUndo,
  undoFileOperation,
} from "./fileOperationJobs";

beforeEach(() => {
  useFileOperationUndoStore.setState(useFileOperationUndoStore.getInitialState());
});

describe("fileOperationJobs", () => {
  it("builds ZIP selection jobs from panel path semantics", () => {
    expect(
      buildZipSelectionJob(["/source/a.txt"], {
        currentPath: "/Users/me/Dropbox",
        resolvedPath: "/Users/me/Library/CloudStorage/Dropbox",
      })
    ).toEqual({
      kind: "zipSelection",
      paths: ["/source/a.txt"],
      targetDir: "/Users/me/Library/CloudStorage/Dropbox",
      archiveName: "Dropbox",
    });
  });

  it("adds overwrite only when requested for copy jobs", () => {
    expect(
      buildCopyJob({
        sourcePaths: ["/source/a.txt"],
        targetPath: "/target",
        keepBoth: true,
      })
    ).toEqual({
      kind: "copy",
      sourcePaths: ["/source/a.txt"],
      targetPath: "/target",
      keepBoth: true,
    });

    expect(
      buildCopyJob({
        sourcePaths: ["/source/a.txt"],
        targetPath: "/target",
        overwrite: true,
      })
    ).toMatchObject({ overwrite: true });
  });

  it("registers undo metadata when a move job is accepted", async () => {
    const submitJob = vi.fn().mockResolvedValue({
      id: "job-1",
      kind: "move",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 1, currentFile: "", unit: "items" },
    });

    await submitMoveJobWithUndo({
      client: { submitJob },
      sourcePaths: ["/source/a.txt"],
      targetDir: "/target",
      targetIsDirectory: true,
    });

    expect(submitJob).toHaveBeenCalledWith({
      kind: "move",
      sourcePaths: ["/source/a.txt"],
      targetDir: "/target",
    });
    expect(useFileOperationUndoStore.getState().pendingMoveOperations["job-1"])
      .toMatchObject({
        kind: "move",
        entries: [{ originalPath: "/source/a.txt", currentPath: "/target/a.txt" }],
      });
  });

  it("passes overwrite intent through move jobs", async () => {
    const submitJob = vi.fn().mockResolvedValue({
      id: "job-1",
      kind: "move",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 1, currentFile: "", unit: "items" },
    });

    await submitMoveJobWithUndo({
      client: { submitJob },
      sourcePaths: ["/source/a.txt"],
      targetDir: "/target",
      targetIsDirectory: true,
      overwrite: true,
    });

    expect(submitJob).toHaveBeenCalledWith({
      kind: "move",
      sourcePaths: ["/source/a.txt"],
      targetDir: "/target",
      overwrite: true,
    });
  });

  it("undoes file operations in reverse order and reports refresh directories", async () => {
    const operation = {
      id: "move-1",
      kind: "move" as const,
      createdAt: 1,
      entries: [
        { originalPath: "/source/a.txt", currentPath: "/target/a.txt" },
        { originalPath: "/source/b.txt", currentPath: "/target/b.txt" },
      ],
    };
    const moveFiles = vi.fn().mockResolvedValue(undefined);
    useFileOperationUndoStore.setState({ lastOperation: operation });

    await expect(undoFileOperation({ moveFiles }, operation)).resolves.toEqual(
      ["/source", "/target"]
    );

    expect(moveFiles).toHaveBeenNthCalledWith(1, ["/target/b.txt"], "/source/b.txt");
    expect(moveFiles).toHaveBeenNthCalledWith(2, ["/target/a.txt"], "/source/a.txt");
    expect(useFileOperationUndoStore.getState().lastOperation).toBeNull();
  });

  it("deduplicates directories to refresh after undo", () => {
    expect(
      getUndoRefreshDirectories({
        id: "move-1",
        kind: "move",
        createdAt: 1,
        entries: [
          { originalPath: "/source/a.txt", currentPath: "/target/a.txt" },
          { originalPath: "/source/b.txt", currentPath: "/target/b.txt" },
        ],
      })
    ).toEqual(["/source", "/target"]);
  });
});
