import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressDialog } from "./ProgressDialog";
import { useDialogStore } from "../../store/dialogStore";
import { useJobStore } from "../../store/jobStore";

const { listenHandlers, mockCancelJob, mockListJobs, mockRetryJob, mockClearFinishedJobs } = vi.hoisted(() => ({
  listenHandlers: new Map<string, (event: { payload: unknown }) => void>(),
  mockCancelJob: vi.fn(),
  mockListJobs: vi.fn(),
  mockRetryJob: vi.fn(),
  mockClearFinishedJobs: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockImplementation(async (eventName: string, handler: (event: { payload: unknown }) => void) => {
    listenHandlers.set(eventName, handler);
    return () => {
      listenHandlers.delete(eventName);
    };
  }),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    cancelJob: mockCancelJob,
    listJobs: mockListJobs,
    retryJob: mockRetryJob,
    clearFinishedJobs: mockClearFinishedJobs,
  }),
}));

describe("ProgressDialog", () => {
  beforeEach(() => {
    useDialogStore.setState(useDialogStore.getInitialState());
    useJobStore.setState(useJobStore.getInitialState());
    listenHandlers.clear();
    mockCancelJob.mockReset();
    mockListJobs.mockReset();
    mockRetryJob.mockReset();
    mockClearFinishedJobs.mockReset();
    mockListJobs.mockResolvedValue([]);
  });

  it("shows delete progress details", async () => {
    useDialogStore.getState().setOpenDialog("progress");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-1",
        kind: "delete",
        status: "running",
        createdAt: 1,
        updatedAt: 1,
        progress: { current: 0, total: 0, currentFile: "", unit: "items" },
        error: null,
        result: null,
      },
    ]);

    render(<ProgressDialog />);

    await Promise.resolve();

    await waitFor(() => {
      expect(screen.getByText("Deleting Files...")).toBeInTheDocument();
    });

    act(() => {
      listenHandlers.get("fs-progress")?.({
        payload: {
          operation: "delete",
          current: 1,
          total: 4,
          currentFile: "LargeFolder",
          unit: "items",
        },
      });
    });

    expect(screen.getByText("Deleting Files...")).toBeInTheDocument();
    expect(screen.getByText("LargeFolder")).toBeInTheDocument();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("Queued: 0")).toBeInTheDocument();
    expect(screen.getByText("Failed: 0")).toBeInTheDocument();
  });

  it("cancels the active job via cancelJob", async () => {
    mockCancelJob.mockResolvedValue({
      id: "job-1",
      kind: "delete",
      status: "cancelled",
      createdAt: 1,
      updatedAt: 2,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: "Operation cancelled.",
      result: null,
    });
    useDialogStore.getState().setOpenDialog("progress");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-1",
        kind: "delete",
        status: "running",
        createdAt: 1,
        updatedAt: 1,
        progress: { current: 0, total: 0, currentFile: "", unit: "items" },
        error: null,
        result: null,
      },
    ]);

    render(<ProgressDialog />);

    await Promise.resolve();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    act(() => {
      screen.getByRole("button", { name: "Cancel" }).click();
    });

    expect(mockCancelJob).toHaveBeenCalledWith("job-1");
  });

  it("retries the most recent failed job", async () => {
    mockRetryJob.mockResolvedValue({
      id: "job-2",
      kind: "copy",
      status: "queued",
      createdAt: 2,
      updatedAt: 2,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });
    useDialogStore.getState().setOpenDialog("progress");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-1",
        kind: "copy",
        status: "failed",
        createdAt: 1,
        updatedAt: 2,
        progress: { current: 1, total: 2, currentFile: "notes.txt", unit: "items" },
        error: "Disk full",
        result: null,
      },
    ]);

    render(<ProgressDialog />);

    await Promise.resolve();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry failed" })).toBeInTheDocument();
    });

    act(() => {
      screen.getByRole("button", { name: "Retry failed" }).click();
    });

    expect(mockRetryJob).toHaveBeenCalledWith("job-1");
  });

  it("clears finished jobs from the dialog state", async () => {
    mockClearFinishedJobs.mockResolvedValue(undefined);
    useDialogStore.getState().setOpenDialog("progress");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-0",
        kind: "zip",
        status: "running",
        createdAt: 0,
        updatedAt: 1,
        progress: { current: 0, total: 3, currentFile: "Folder", unit: "items" },
        error: null,
        result: null,
      },
      {
        id: "job-1",
        kind: "delete",
        status: "completed",
        createdAt: 1,
        updatedAt: 2,
        progress: { current: 1, total: 1, currentFile: "Done", unit: "items" },
        error: null,
        result: {
          affectedDirectories: ["/tmp"],
          affectedEntryPaths: ["/tmp/file.txt"],
          archivePath: null,
          savedNames: [],
        },
      },
    ]);

    render(<ProgressDialog />);

    await Promise.resolve();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Clear finished" })).toBeInTheDocument();
    });

    act(() => {
      screen.getByRole("button", { name: "Clear finished" }).click();
    });

    expect(mockClearFinishedJobs).toHaveBeenCalledTimes(1);
  });

  it("closes automatically when only finished jobs remain", async () => {
    useDialogStore.getState().setOpenDialog("progress");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-1",
        kind: "zip",
        status: "completed",
        createdAt: 1,
        updatedAt: 2,
        progress: { current: 1, total: 1, currentFile: "Done", unit: "items" },
        error: null,
        result: {
          affectedDirectories: ["/tmp"],
          affectedEntryPaths: ["/tmp/folder"],
          archivePath: "/tmp/folder.zip",
          savedNames: [],
        },
      },
    ]);

    render(<ProgressDialog />);

    await waitFor(() => {
      expect(useDialogStore.getState().openDialog).toBeNull();
    });
  });
});
