import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogContainer } from "./DialogContainer";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";

const {
  mockSubmitJob,
  mockCheckCopyConflicts,
  mockShowTransientStatusMessage,
} = vi.hoisted(() => ({
  mockSubmitJob: vi.fn(),
  mockCheckCopyConflicts: vi.fn(),
  mockShowTransientStatusMessage: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    createDirectory: vi.fn(),
    createFile: vi.fn(),
    renameFile: vi.fn(),
    submitJob: mockSubmitJob,
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    checkCopyConflicts: mockCheckCopyConflicts,
    getDirSize: vi.fn().mockResolvedValue(0),
  }),
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback,
}));

vi.mock("./QuickPreviewDialog", () => ({
  QuickPreviewDialog: () => null,
}));

vi.mock("./SettingsDialog", () => ({
  SettingsDialog: () => null,
}));

vi.mock("../../hooks/useAppCommands", () => ({
  showTransientStatusMessage: mockShowTransientStatusMessage,
}));

const setSelectedDeleteState = () => {
  usePanelStore.setState((state) => ({
    ...state,
    activePanel: "left",
    leftPanel: {
      ...state.leftPanel,
      currentPath: "/home/user",
      resolvedPath: "/home/user",
      files: [
        { name: "..", path: "/home", kind: "directory" },
        { name: "LargeFolder", path: "/home/user/LargeFolder", kind: "directory", size: null },
      ],
      selectedItems: new Set<string>(["/home/user/LargeFolder"]),
      cursorIndex: 1,
      tabs: state.leftPanel.tabs.map((tab) =>
        tab.id === state.leftPanel.activeTabId
          ? {
              ...tab,
              currentPath: "/home/user",
              resolvedPath: "/home/user",
              files: [
                { name: "..", path: "/home", kind: "directory" },
                {
                  name: "LargeFolder",
                  path: "/home/user/LargeFolder",
                  kind: "directory",
                  size: null,
                },
              ],
              selectedItems: new Set<string>(["/home/user/LargeFolder"]),
              cursorIndex: 1,
            }
          : tab
      ),
    },
  }));
};

describe("DialogContainer", () => {
  beforeEach(() => {
    useDialogStore.setState(useDialogStore.getInitialState());
    usePanelStore.setState(usePanelStore.getInitialState());
    setSelectedDeleteState();
    useDialogStore.getState().setOpenDialog("delete");
    mockSubmitJob.mockReset();
    mockCheckCopyConflicts.mockReset();
    mockShowTransientStatusMessage.mockReset();
    mockCheckCopyConflicts.mockResolvedValue([]);
  });

  it("submits a delete job and switches to the progress dialog", async () => {
    mockSubmitJob.mockResolvedValue({
      id: "job-1",
      kind: "delete",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });

    render(<DialogContainer />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: "delete",
        paths: ["/home/user/LargeFolder"],
        permanent: false,
      });
    });
    expect(useDialogStore.getState().openDialog).toBe("progress");
  });

  it("submits a drag-copy request to the queued copy job", async () => {
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: "left",
      leftPanel: {
        ...state.leftPanel,
        currentPath: "/source",
        resolvedPath: "/source",
      },
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/target",
        resolvedPath: "/target",
      },
    }));
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "copy",
      dragCopyRequest: {
        sourcePanelId: "left",
        targetPanelId: "right",
        sourcePaths: ["/source/file.txt"],
        targetPath: "/target/subdir",
      },
      isPasteMode: false,
    }));
    mockSubmitJob.mockResolvedValue({
      id: "job-2",
      kind: "copy",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });

    render(<DialogContainer />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ["/source/file.txt"],
        "/target/subdir"
      );
    });
    expect(mockSubmitJob).toHaveBeenCalledWith({
      kind: "copy",
      sourcePaths: ["/source/file.txt"],
      targetPath: "/target/subdir",
      keepBoth: false,
    });
    expect(mockShowTransientStatusMessage).not.toHaveBeenCalled();
    expect(useDialogStore.getState().openDialog).toBe("progress");
  });

  it("submits overwrite-all from a drag-copy conflict dialog", async () => {
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: "left",
      leftPanel: {
        ...state.leftPanel,
        currentPath: "/source",
        resolvedPath: "/source",
      },
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/target",
        resolvedPath: "/target",
      },
    }));
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "copy",
      dragCopyRequest: {
        sourcePanelId: "left",
        targetPanelId: "right",
        sourcePaths: ["/source/file.txt"],
        targetPath: "/target",
      },
      isPasteMode: false,
    }));
    mockCheckCopyConflicts.mockResolvedValue(["file.txt"]);
    mockSubmitJob.mockResolvedValue({
      id: "job-3",
      kind: "copy",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });

    render(<DialogContainer />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(screen.getByText("Files Already Exist")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Overwrite All" }));

    await waitFor(() => {
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: "copy",
        sourcePaths: ["/source/file.txt"],
        targetPath: "/target",
        keepBoth: false,
      });
    });
    expect(useDialogStore.getState().openDialog).toBe("progress");
  });

  it("falls back to the target panel path when dragCopyRequest targetPath is blank", async () => {
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: "left",
      leftPanel: {
        ...state.leftPanel,
        currentPath: "/left-source",
        resolvedPath: "/left-source",
      },
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/target",
        resolvedPath: "/target",
      },
    }));
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "copy",
      dragCopyRequest: {
        sourcePanelId: "left",
        targetPanelId: "right",
        sourcePaths: ["/left-source/file.txt"],
        targetPath: "",
      },
      isPasteMode: false,
    }));

    render(<DialogContainer />);

    expect(screen.getByText("Copy 1 file")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
    expect(screen.getByText('"file.txt"')).toBeInTheDocument();
  });

  it("submits overwrite-all with the target panel path when dragCopyRequest targetPath is blank", async () => {
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: "left",
      leftPanel: {
        ...state.leftPanel,
        currentPath: "/source",
        resolvedPath: "/source",
      },
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/target",
        resolvedPath: "/target",
      },
    }));
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "copy",
      dragCopyRequest: {
        sourcePanelId: "left",
        targetPanelId: "right",
        sourcePaths: ["/source/file.txt"],
        targetPath: "",
      },
      isPasteMode: false,
    }));
    mockCheckCopyConflicts.mockResolvedValue(["file.txt"]);
    mockSubmitJob.mockResolvedValue({
      id: "job-4",
      kind: "copy",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });

    render(<DialogContainer />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(screen.getByText("Files Already Exist")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Overwrite All" }));

    await waitFor(() => {
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: "copy",
        sourcePaths: ["/source/file.txt"],
        targetPath: "/target",
        keepBoth: false,
      });
    });
  });

  it("uses target panel currentPath when target resolvedPath is blank", async () => {
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: "left",
      leftPanel: {
        ...state.leftPanel,
        currentPath: "/source",
        resolvedPath: "/source",
      },
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/target",
        resolvedPath: "",
      },
    }));
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "copy",
      dragCopyRequest: {
        sourcePanelId: "left",
        targetPanelId: "right",
        sourcePaths: ["/source/file.txt"],
        targetPath: "",
      },
      isPasteMode: false,
    }));

    render(<DialogContainer />);

    expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
  });

  it("preserves drag-copy payload when overwrite-all fails and the copy dialog reopens", async () => {
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: "left",
      leftPanel: {
        ...state.leftPanel,
        currentPath: "/source",
        resolvedPath: "/source",
      },
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/target",
        resolvedPath: "/target",
      },
    }));
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "copy",
      dragCopyRequest: {
        sourcePanelId: "left",
        targetPanelId: "right",
        sourcePaths: ["/source/file.txt"],
        targetPath: "/target",
      },
      isPasteMode: false,
    }));
    mockCheckCopyConflicts.mockResolvedValue(["file.txt"]);
    mockSubmitJob.mockRejectedValue(new Error("submit failed"));

    render(<DialogContainer />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(screen.getByText("Files Already Exist")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Overwrite All" }));

    await waitFor(() => {
      expect(screen.getByText("Copy 1 file")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
    expect(screen.getByText('"file.txt"')).toBeInTheDocument();
  });
});
