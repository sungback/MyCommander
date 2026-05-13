import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogStore } from "../store/dialogStore";
import { useFileOperationUndoStore } from "../store/fileOperationUndoStore";
import { useJobStore } from "../store/jobStore";
import type { JobRecord } from "../types/job";
import { useJobQueue } from "./useJobQueue";

const {
  listenHandlers,
  mockListJobs,
  mockRefreshPanelsForDirectories,
  mockRefreshPanelsForEntryPaths,
  mockRemoveDeletedPathsFromVisiblePanels,
} = vi.hoisted(() => ({
  listenHandlers: new Map<string, (event: { payload: unknown }) => void>(),
  mockListJobs: vi.fn(),
  mockRefreshPanelsForDirectories: vi.fn(),
  mockRefreshPanelsForEntryPaths: vi.fn(),
  mockRemoveDeletedPathsFromVisiblePanels: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockImplementation(
    async (eventName: string, handler: (event: { payload: unknown }) => void) => {
      listenHandlers.set(eventName, handler);
      return () => {
        listenHandlers.delete(eventName);
      };
    }
  ),
}));

vi.mock("../store/panelRefresh", () => ({
  refreshPanelsForDirectories: (...args: unknown[]) =>
    mockRefreshPanelsForDirectories(...args),
  refreshPanelsForEntryPaths: (...args: unknown[]) =>
    mockRefreshPanelsForEntryPaths(...args),
  removeDeletedPathsFromVisiblePanels: (...args: unknown[]) =>
    mockRemoveDeletedPathsFromVisiblePanels(...args),
}));

vi.mock("./useFileSystem", () => ({
  useFileSystem: () => ({
    listJobs: mockListJobs,
  }),
}));

const makeJob = (overrides: Partial<JobRecord> = {}): JobRecord => ({
  id: "job-1",
  kind: "copy",
  status: "running",
  createdAt: 1,
  updatedAt: 2,
  progress: { current: 0, total: 1, currentFile: "", unit: "items" },
  error: null,
  result: null,
  ...overrides,
});

describe("useJobQueue", () => {
  beforeEach(() => {
    useDialogStore.setState(useDialogStore.getInitialState());
    useFileOperationUndoStore.setState(
      useFileOperationUndoStore.getInitialState()
    );
    useJobStore.getState().resetJobs();
    listenHandlers.clear();
    mockListJobs.mockReset();
    mockRefreshPanelsForDirectories.mockReset();
    mockRefreshPanelsForEntryPaths.mockReset();
    mockRemoveDeletedPathsFromVisiblePanels.mockReset();
    mockListJobs.mockResolvedValue([]);
  });

  it("calls listJobs on mount", async () => {
    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(1);
    });
  });

  it("does not open ProgressDialog when job list is empty", async () => {
    mockListJobs.mockResolvedValue([]);

    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalled();
    });

    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("opens ProgressDialog when there are queued jobs", async () => {
    mockListJobs.mockResolvedValue([makeJob({ status: "queued" })]);

    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(useDialogStore.getState().openDialog).toBe("progress");
    });
  });

  it("opens ProgressDialog when there are running jobs", async () => {
    mockListJobs.mockResolvedValue([makeJob({ status: "running" })]);

    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(useDialogStore.getState().openDialog).toBe("progress");
    });
  });

  it("does not open ProgressDialog when only failed jobs are restored", async () => {
    mockListJobs.mockResolvedValue([makeJob({ status: "failed" })]);

    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalled();
    });

    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("does not open ProgressDialog when only completed jobs exist", async () => {
    mockListJobs.mockResolvedValue([makeJob({ status: "completed" })]);

    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalled();
    });

    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("calls upsertJob when job-updated event fires", async () => {
    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(listenHandlers.has("job-updated")).toBe(true);
    });

    const job = makeJob({ status: "running" });

    act(() => {
      listenHandlers.get("job-updated")?.({ payload: job });
    });

    expect(useJobStore.getState().jobs).toContainEqual(job);
  });

  it("calls removeDeletedPathsFromVisiblePanels when a delete job completes", async () => {
    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(listenHandlers.has("job-updated")).toBe(true);
    });

    const runningJob = makeJob({ kind: "delete", status: "running" });

    act(() => {
      listenHandlers.get("job-updated")?.({ payload: runningJob });
    });

    const completedJob = makeJob({
      kind: "delete",
      status: "completed",
      result: {
        affectedEntryPaths: ["/some/path/file.txt"],
        affectedDirectories: ["/some/path"],
        savedNames: [],
        archivePath: null,
      },
    });

    act(() => {
      listenHandlers.get("job-updated")?.({ payload: completedJob });
    });

    expect(mockRemoveDeletedPathsFromVisiblePanels).toHaveBeenCalledWith([
      "/some/path/file.txt",
    ]);
    expect(mockRefreshPanelsForEntryPaths).toHaveBeenCalledWith([
      "/some/path/file.txt",
    ], "delete-completed");
    expect(mockRefreshPanelsForDirectories).not.toHaveBeenCalled();
  });

  it("calls refreshPanelsForDirectories when a copy job completes", async () => {
    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(listenHandlers.has("job-updated")).toBe(true);
    });

    const runningJob = makeJob({ kind: "copy", status: "running" });

    act(() => {
      listenHandlers.get("job-updated")?.({ payload: runningJob });
    });

    const completedJob = makeJob({
      kind: "copy",
      status: "completed",
      result: {
        affectedEntryPaths: [],
        affectedDirectories: ["/target/dir"],
        savedNames: [],
        archivePath: null,
      },
    });

    act(() => {
      listenHandlers.get("job-updated")?.({ payload: completedJob });
    });

    expect(mockRefreshPanelsForDirectories).toHaveBeenCalledWith(
      ["/target/dir"],
      "job-completed"
    );
    expect(mockRemoveDeletedPathsFromVisiblePanels).not.toHaveBeenCalled();
  });

  it("promotes pending move undo metadata when a move job completes", async () => {
    useFileOperationUndoStore.getState().registerPendingMoveUndo("job-1", [
      {
        originalPath: "/source/a.txt",
        currentPath: "/target/a.txt",
      },
    ]);
    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(listenHandlers.has("job-updated")).toBe(true);
    });

    act(() => {
      listenHandlers.get("job-updated")?.({
        payload: makeJob({ id: "job-1", kind: "move", status: "running" }),
      });
    });

    act(() => {
      listenHandlers.get("job-updated")?.({
        payload: makeJob({
          id: "job-1",
          kind: "move",
          status: "completed",
          result: {
            affectedEntryPaths: ["/source/a.txt"],
            affectedDirectories: ["/source", "/target"],
            savedNames: [],
            archivePath: null,
          },
        }),
      });
    });

    const undoState = useFileOperationUndoStore.getState();
    expect(undoState.pendingMoveOperations["job-1"]).toBeUndefined();
    expect(undoState.lastOperation).toEqual(
      expect.objectContaining({
        kind: "move",
        entries: [
          {
            originalPath: "/source/a.txt",
            currentPath: "/target/a.txt",
          },
        ],
      })
    );
  });

  it("discards pending move undo metadata when a move job fails", async () => {
    useFileOperationUndoStore.getState().registerPendingMoveUndo("job-1", [
      {
        originalPath: "/source/a.txt",
        currentPath: "/target/a.txt",
      },
    ]);
    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(listenHandlers.has("job-updated")).toBe(true);
    });

    act(() => {
      listenHandlers.get("job-updated")?.({
        payload: makeJob({ id: "job-1", kind: "move", status: "running" }),
      });
    });

    act(() => {
      listenHandlers.get("job-updated")?.({
        payload: makeJob({ id: "job-1", kind: "move", status: "failed" }),
      });
    });

    const undoState = useFileOperationUndoStore.getState();
    expect(undoState.pendingMoveOperations["job-1"]).toBeUndefined();
    expect(undoState.lastOperation).toBeNull();
  });

  it("does not open ProgressDialog if it is already open", async () => {
    useDialogStore.getState().setOpenDialog("progress");

    mockListJobs.mockResolvedValue([makeJob({ status: "running" })]);

    const setOpenDialogSpy = vi.spyOn(useDialogStore.getState(), "setOpenDialog");

    renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalled();
    });

    expect(setOpenDialogSpy).not.toHaveBeenCalled();
    expect(useDialogStore.getState().openDialog).toBe("progress");
  });

  it("unregisters the job-updated listener on unmount", async () => {
    const { unmount } = renderHook(() => useJobQueue());

    await waitFor(() => {
      expect(listenHandlers.has("job-updated")).toBe(true);
    });

    unmount();

    await waitFor(() => {
      expect(listenHandlers.has("job-updated")).toBe(false);
    });
  });
});
