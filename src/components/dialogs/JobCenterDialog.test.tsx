import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobCenterDialog } from "./JobCenterDialog";
import { useDialogStore } from "../../store/dialogStore";
import { useJobStore } from "../../store/jobStore";

const {
  mockCancelJob,
  mockRetryJob,
  mockClearFinishedJobs,
} = vi.hoisted(() => ({
  mockCancelJob: vi.fn(),
  mockRetryJob: vi.fn(),
  mockClearFinishedJobs: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    cancelJob: mockCancelJob,
    retryJob: mockRetryJob,
    clearFinishedJobs: mockClearFinishedJobs,
  }),
}));

describe("JobCenterDialog", () => {
  beforeEach(() => {
    useDialogStore.setState(useDialogStore.getInitialState());
    useJobStore.setState(useJobStore.getInitialState());
    mockCancelJob.mockReset();
    mockRetryJob.mockReset();
    mockClearFinishedJobs.mockReset();
  });

  it("renders grouped jobs and allows retry/cancel", async () => {
    useDialogStore.getState().setOpenDialog("jobcenter");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-running",
        kind: "copy",
        status: "running",
        createdAt: 1,
        updatedAt: 1,
        progress: { current: 1, total: 3, currentFile: "a.txt", unit: "items" },
        error: null,
        result: null,
      },
      {
        id: "job-failed",
        kind: "delete",
        status: "failed",
        createdAt: 2,
        updatedAt: 2,
        progress: { current: 1, total: 2, currentFile: "b.txt", unit: "items" },
        error: "Disk full",
        result: null,
      },
    ]);
    mockCancelJob.mockResolvedValue({
      id: "job-running",
      kind: "copy",
      status: "cancelled",
      createdAt: 1,
      updatedAt: 3,
      progress: { current: 1, total: 3, currentFile: "a.txt", unit: "items" },
      error: "Cancelled",
      result: null,
    });
    mockRetryJob.mockResolvedValue({
      id: "job-retry",
      kind: "delete",
      status: "queued",
      createdAt: 3,
      updatedAt: 3,
      progress: { current: 0, total: 1, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });

    render(<JobCenterDialog />);

    await waitFor(() => {
      expect(screen.getByText("Copy · job-running")).toBeInTheDocument();
    });

    expect(screen.getByText("Copy · job-running")).toBeInTheDocument();
    expect(screen.getByText("Delete · job-failed")).toBeInTheDocument();
    expect(screen.getByText("Disk full")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Cancel" }).click();
    });
    expect(mockCancelJob).toHaveBeenCalledWith("job-running");

    act(() => {
      screen.getByRole("button", { name: "Retry" }).click();
    });
    expect(mockRetryJob).toHaveBeenCalledWith("job-failed");
  });

  it("clears finished jobs from the list", async () => {
    useDialogStore.getState().setOpenDialog("jobcenter");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-done",
        kind: "zip",
        status: "completed",
        createdAt: 1,
        updatedAt: 1,
        progress: { current: 1, total: 1, currentFile: "done.zip", unit: "items" },
        error: null,
        result: null,
      },
    ]);
    mockClearFinishedJobs.mockResolvedValue(undefined);

    render(<JobCenterDialog />);

    await waitFor(() => {
      expect(screen.getByText("Zip · job-done")).toBeInTheDocument();
    });

    act(() => {
      screen.getByRole("button", { name: "Clear finished" }).click();
    });

    expect(mockClearFinishedJobs).toHaveBeenCalledTimes(1);
  });

  it("filters to failed jobs only when the failed filter is selected", async () => {
    useDialogStore.getState().setOpenDialog("jobcenter");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-running",
        kind: "copy",
        status: "running",
        createdAt: 1,
        updatedAt: 1,
        progress: { current: 1, total: 3, currentFile: "a.txt", unit: "items" },
        error: null,
        result: null,
      },
      {
        id: "job-failed",
        kind: "delete",
        status: "failed",
        createdAt: 2,
        updatedAt: 2,
        progress: { current: 1, total: 2, currentFile: "b.txt", unit: "items" },
        error: "Disk full",
        result: null,
      },
    ]);

    render(<JobCenterDialog />);

    act(() => {
      screen.getByRole("button", { name: "Failed" }).click();
    });

    expect(screen.getByText("Delete · job-failed")).toBeInTheDocument();
    expect(screen.queryByText("Copy · job-running")).not.toBeInTheDocument();
  });

  it("sorts jobs by newest first when selected", async () => {
    useDialogStore.getState().setOpenDialog("jobcenter");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-older",
        kind: "copy",
        status: "queued",
        createdAt: 1,
        updatedAt: 1,
        progress: { current: 0, total: 1, currentFile: "older.txt", unit: "items" },
        error: null,
        result: null,
      },
      {
        id: "job-newer",
        kind: "move",
        status: "queued",
        createdAt: 10,
        updatedAt: 10,
        progress: { current: 0, total: 1, currentFile: "newer.txt", unit: "items" },
        error: null,
        result: null,
      },
    ]);

    render(<JobCenterDialog />);

    act(() => {
      const select = screen.getByLabelText("Sort jobs") as HTMLSelectElement;
      select.value = "newest";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const queuedCards = screen.getAllByTestId("job-card-queued");
    expect(queuedCards[0]).toHaveTextContent("Move · job-newer");
    expect(queuedCards[1]).toHaveTextContent("Copy · job-older");
  });

  it("shows the updated timestamp for each job", async () => {
    useDialogStore.getState().setOpenDialog("jobcenter");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-timestamp",
        kind: "zip",
        status: "completed",
        createdAt: 1,
        updatedAt: Date.UTC(2026, 3, 20, 14, 30),
        progress: { current: 1, total: 1, currentFile: "done.zip", unit: "items" },
        error: null,
        result: null,
      },
    ]);

    render(<JobCenterDialog />);

    await waitFor(() => {
      expect(screen.getByText((text) => text.startsWith("Updated 2026.04.20"))).toBeInTheDocument();
    });
  });

  it("opens a detail pane when a job card is clicked", async () => {
    useDialogStore.getState().setOpenDialog("jobcenter");
    useJobStore.getState().hydrateJobs([
      {
        id: "job-detail",
        kind: "copy",
        status: "completed",
        createdAt: 1,
        updatedAt: 2,
        progress: { current: 2, total: 2, currentFile: "b.txt", unit: "items" },
        error: null,
        result: {
          affectedDirectories: ["/dest", "/src"],
          affectedEntryPaths: ["/src/a.txt", "/src/b.txt"],
          archivePath: null,
          savedNames: ["a.txt", "b.txt"],
        },
      },
    ]);

    render(<JobCenterDialog />);

    await waitFor(() => {
      expect(screen.getByText("Copy · job-detail")).toBeInTheDocument();
    });

    act(() => {
      screen.getByTestId("job-card-finished").click();
    });

    expect(screen.getByText("Job details")).toBeInTheDocument();
    expect(screen.getByText("Affected directories")).toBeInTheDocument();
    expect(screen.getByText("/dest")).toBeInTheDocument();
    expect(screen.getByText("Saved names")).toBeInTheDocument();
    expect(screen.getByText("a.txt")).toBeInTheDocument();
  });
});
