import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncDialog } from "./SyncDialog";
import { useTransferSpaceWarningStore } from "../../../store/transferSpaceWarningStore";

const {
  mockCloseDialog,
  mockCompareDirectories,
  mockCheckTransferSpace,
  mockCopyFiles,
  mockRefreshPanel,
  mockSetSelection,
  mockPanelFiles,
  mockShowHiddenFiles,
} = vi.hoisted(() => ({
  mockCloseDialog: vi.fn(),
  mockCompareDirectories: vi.fn(),
  mockCheckTransferSpace: vi.fn(),
  mockCopyFiles: vi.fn(),
  mockRefreshPanel: vi.fn(),
  mockSetSelection: vi.fn(),
  mockPanelFiles: { left: [] as unknown[], right: [] as unknown[] },
  mockShowHiddenFiles: { value: false },
}));

vi.mock("../../../store/dialogStore", () => ({
  useDialogStore: () => ({
    openDialog: "sync",
    closeDialog: mockCloseDialog,
  }),
}));

vi.mock("../../../store/panelStore", () => ({
  usePanelStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      leftPanel: {
        currentPath: "/left",
        resolvedPath: "/left",
        files: mockPanelFiles.left,
      },
      rightPanel: {
        currentPath: "/right",
        resolvedPath: "/right",
        files: mockPanelFiles.right,
      },
      showHiddenFiles: mockShowHiddenFiles.value,
      refreshPanel: mockRefreshPanel,
      setSelection: mockSetSelection,
    }),
}));

vi.mock("../../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    compareDirectories: mockCompareDirectories,
    copyFiles: mockCopyFiles,
    checkTransferSpace: mockCheckTransferSpace,
  }),
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback,
}));

describe("SyncDialog", () => {
  beforeEach(() => {
    mockCloseDialog.mockReset();
    mockCompareDirectories.mockReset();
    mockCopyFiles.mockReset();
    mockCheckTransferSpace.mockReset();
    useTransferSpaceWarningStore.setState({ pending: null });
    mockRefreshPanel.mockReset();
    mockSetSelection.mockReset();
    mockPanelFiles.left = [];
    mockPanelFiles.right = [];
    mockShowHiddenFiles.value = false;
    mockCopyFiles.mockResolvedValue([]);
    mockCheckTransferSpace.mockResolvedValue({
      requiredBytes: 0,
      availableBytes: 1_000,
      complete: true,
      insufficient: false,
    });
  });

  it("passes the global hidden-files toggle to directory analysis", async () => {
    mockCompareDirectories.mockResolvedValue([]);

    render(<SyncDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(mockCompareDirectories).toHaveBeenCalledWith("/left", "/right", false);
    });
  });

  it("separates an empty comparison from a failed comparison", async () => {
    mockCompareDirectories.mockResolvedValue([]);

    render(<SyncDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(await screen.findByText("No differences found.")).toBeInTheDocument();
    expect(
      screen.getByText("The selected folders have no actionable sync items.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Synchronize" })).toBeDisabled();
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
        "/right/docs/report.md",
        false,
        true
      );
    });
  });

  describe("Select in Panels", () => {
    const differences = [
      {
        relPath: "a.txt",
        leftPath: "/left/a.txt",
        rightPath: null,
        leftKind: "file",
        rightKind: null,
        status: "LeftOnly",
        direction: "toRight",
      },
      {
        relPath: "docs/x.md",
        leftPath: "/left/docs/x.md",
        rightPath: "/right/docs/x.md",
        leftKind: "file",
        rightKind: "file",
        status: "RightNewer",
        direction: "toLeft",
      },
      {
        relPath: "same.txt",
        leftPath: "/left/same.txt",
        rightPath: "/right/same.txt",
        leftKind: "file",
        rightKind: "file",
        status: "Same",
        direction: "skip",
      },
    ];
    const entry = (base: string, name: string, kind: string) => ({
      name,
      path: `${base}/${name}`,
      kind,
    });

    it("selects the differing top-level items in both panels and closes the dialog", async () => {
      mockPanelFiles.left = [
        entry("/left", "..", "directory"),
        entry("/left", "a.txt", "file"),
        entry("/left", "docs", "directory"),
        entry("/left", "same.txt", "file"),
      ];
      mockPanelFiles.right = [
        entry("/right", "docs", "directory"),
        entry("/right", "same.txt", "file"),
      ];
      mockCompareDirectories.mockResolvedValue(differences);
      render(<SyncDialog />);
      fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
      await screen.findByText("Found 3 item(s) to compare");

      fireEvent.click(screen.getByRole("button", { name: "Select in Panels" }));

      expect(mockSetSelection).toHaveBeenCalledWith("left", ["/left/a.txt", "/left/docs"]);
      expect(mockSetSelection).toHaveBeenCalledWith("right", ["/right/docs"]);
      expect(mockCloseDialog).toHaveBeenCalled();
    });

    it("refuses when the compared paths are not the panel folders", async () => {
      mockCompareDirectories.mockResolvedValue(differences);
      render(<SyncDialog />);
      fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "/elsewhere" } });
      fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
      await screen.findByText("Found 3 item(s) to compare");

      fireEvent.click(screen.getByRole("button", { name: "Select in Panels" }));

      expect(mockSetSelection).not.toHaveBeenCalled();
      expect(mockCloseDialog).not.toHaveBeenCalled();
      expect(screen.getByText(/only be selected when comparing the folders open/)).toBeInTheDocument();
    });
  });

  it("does not copy when the user cancels the low-space warning", async () => {
    mockCheckTransferSpace.mockResolvedValue({
      requiredBytes: 5_000,
      availableBytes: 1_000,
      complete: true,
      insufficient: true,
    });
    mockCompareDirectories.mockResolvedValue([
      {
        relPath: "big.bin",
        leftPath: "/left/big.bin",
        rightPath: null,
        leftKind: "file",
        rightKind: null,
        status: "LeftOnly",
        direction: "toRight",
      },
    ]);

    render(<SyncDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByText("Found 1 item(s) to compare");
    fireEvent.click(screen.getByRole("button", { name: "Synchronize" }));

    await waitFor(() => {
      expect(useTransferSpaceWarningStore.getState().pending).not.toBeNull();
    });
    expect(mockCheckTransferSpace).toHaveBeenCalledWith(["/left/big.bin"], "/right", false);
    useTransferSpaceWarningStore.getState().respond(false);

    await waitFor(() => {
      expect(useTransferSpaceWarningStore.getState().pending).toBeNull();
    });
    expect(mockCopyFiles).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Synchronize" })).toBeInTheDocument();
  });

  it("exposes synchronization progress while a copy is running", async () => {
    let resolveCopy: (value: unknown[]) => void = () => {};
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
    mockCopyFiles.mockReturnValue(
      new Promise((resolve) => {
        resolveCopy = resolve;
      })
    );

    render(<SyncDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await screen.findByText("Found 1 item(s) to compare");

    fireEvent.click(screen.getByRole("button", { name: "Synchronize" }));

    const progress = await screen.findByRole("progressbar", {
      name: "Synchronization progress",
    });
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "1");
    expect(progress).toHaveAttribute("aria-valuenow", "0");

    resolveCopy([]);

    await waitFor(() => {
      expect(mockCloseDialog).toHaveBeenCalled();
    });
  });

  it("keeps the dialog open and reports failed sync items", async () => {
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
      {
        relPath: "docs/fail.md",
        leftPath: "/left/docs/fail.md",
        rightPath: "/right/docs/fail.md",
        leftKind: "file",
        rightKind: "file",
        status: "LeftNewer",
        direction: "toRight",
      },
    ]);
    mockCopyFiles
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("Permission denied"));

    render(<SyncDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await screen.findByText("Found 2 item(s) to compare");

    fireEvent.click(screen.getByRole("button", { name: "Synchronize" }));

    await waitFor(() => {
      expect(mockCopyFiles).toHaveBeenCalledTimes(2);
    });

    expect(mockRefreshPanel).toHaveBeenCalledWith("left");
    expect(mockRefreshPanel).toHaveBeenCalledWith("right");
    expect(mockCloseDialog).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/1 item failed to synchronize: docs\/fail\.md \(Permission denied\)\./)
    ).toBeInTheDocument();
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

    expect(mockCopyFiles).toHaveBeenCalledWith(["/left/docs"], "/right/docs", false, true);
  });
});
