import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncDialog } from "./SyncDialog";

const {
  mockCloseDialog,
  mockCompareDirectories,
  mockCopyFiles,
  mockRefreshPanel,
  mockShowHiddenFiles,
} = vi.hoisted(() => ({
  mockCloseDialog: vi.fn(),
  mockCompareDirectories: vi.fn(),
  mockCopyFiles: vi.fn(),
  mockRefreshPanel: vi.fn(),
  mockShowHiddenFiles: { value: false },
}));

vi.mock("../../store/dialogStore", () => ({
  useDialogStore: () => ({
    openDialog: "sync",
    closeDialog: mockCloseDialog,
  }),
}));

vi.mock("../../store/panelStore", () => ({
  usePanelStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      leftPanel: {
        currentPath: "/left",
        resolvedPath: "/left",
      },
      rightPanel: {
        currentPath: "/right",
        resolvedPath: "/right",
      },
      showHiddenFiles: mockShowHiddenFiles.value,
      refreshPanel: mockRefreshPanel,
    }),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    compareDirectories: mockCompareDirectories,
    copyFiles: mockCopyFiles,
  }),
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback,
}));

describe("SyncDialog", () => {
  beforeEach(() => {
    mockCloseDialog.mockReset();
    mockCompareDirectories.mockReset();
    mockCopyFiles.mockReset();
    mockRefreshPanel.mockReset();
    mockShowHiddenFiles.value = false;
    mockCopyFiles.mockResolvedValue([]);
  });

  it("passes the global hidden-files toggle to directory analysis", async () => {
    mockCompareDirectories.mockResolvedValue([]);

    render(<SyncDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(mockCompareDirectories).toHaveBeenCalledWith("/left", "/right", false);
    });
  });

  it("preserves relative paths when synchronizing changed files", async () => {
    mockCompareDirectories.mockResolvedValue([
      {
        relPath: "docs/report.md",
        leftPath: "/left/docs/report.md",
        rightPath: "/right/docs/report.md",
        leftKind: "file",
        rightKind: "file",
        status: "LeftNewer",
        direction: "toRight",
      },
    ]);

    render(<SyncDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await screen.findByText("Found 1 item(s) to compare");

    fireEvent.click(screen.getByRole("button", { name: "Synchronize" }));

    await waitFor(() => {
      expect(mockCopyFiles).toHaveBeenCalledWith(
        ["/left/docs/report.md"],
        "/right/docs/report.md"
      );
    });
  });

  it("collapses redundant child items when an entire missing directory is synchronized", async () => {
    mockCompareDirectories.mockResolvedValue([
      {
        relPath: "docs",
        leftPath: "/left/docs",
        rightPath: null,
        leftKind: "directory",
        rightKind: null,
        status: "LeftOnly",
        direction: "toRight",
      },
      {
        relPath: "docs/report.md",
        leftPath: "/left/docs/report.md",
        rightPath: null,
        leftKind: "file",
        rightKind: null,
        status: "LeftOnly",
        direction: "toRight",
      },
    ]);

    render(<SyncDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await screen.findByText("Found 2 item(s) to compare");

    fireEvent.click(screen.getByRole("button", { name: "Synchronize" }));

    await waitFor(() => {
      expect(mockCopyFiles).toHaveBeenCalledTimes(1);
    });

    expect(mockCopyFiles).toHaveBeenCalledWith(["/left/docs"], "/right/docs");
  });
});
