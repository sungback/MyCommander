import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogContainer, getRenameSelectionEnd } from "./DialogContainer";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { useClipboardStore } from "../../store/clipboardStore";

const {
  mockCreateDirectory,
  mockCreateFile,
  mockRenameFile,
  mockGetDirSize,
  mockSubmitJob,
  mockCheckCopyConflicts,
  mockShowTransientStatusMessage,
  mockRefreshPanelsForDirectories,
} = vi.hoisted(() => ({
  mockCreateDirectory: vi.fn(),
  mockCreateFile: vi.fn(),
  mockRenameFile: vi.fn(),
  mockGetDirSize: vi.fn(),
  mockSubmitJob: vi.fn(),
  mockCheckCopyConflicts: vi.fn(),
  mockShowTransientStatusMessage: vi.fn(),
  mockRefreshPanelsForDirectories: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    createDirectory: mockCreateDirectory,
    createFile: mockCreateFile,
    renameFile: mockRenameFile,
    submitJob: mockSubmitJob,
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    checkCopyConflicts: mockCheckCopyConflicts,
    getDirSize: mockGetDirSize,
  }),
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback,
}));

vi.mock("../../store/panelRefresh", () => ({
  refreshPanelsForDirectories: mockRefreshPanelsForDirectories,
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
    useClipboardStore.setState({ clipboard: null });
    setSelectedDeleteState();
    useDialogStore.getState().setOpenDialog("delete");
    mockCreateDirectory.mockReset();
    mockCreateFile.mockReset();
    mockRenameFile.mockReset();
    mockGetDirSize.mockReset();
    mockSubmitJob.mockReset();
    mockCheckCopyConflicts.mockReset();
    mockShowTransientStatusMessage.mockReset();
    mockRefreshPanelsForDirectories.mockReset();
    mockGetDirSize.mockResolvedValue(0);
    mockCheckCopyConflicts.mockResolvedValue([]);
  });

  it("loads folder size in the info dialog for directories without a cached size", async () => {
    mockGetDirSize.mockResolvedValue(2048);
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "info",
      dialogTarget: {
        panelId: "left",
        path: "/home/user/LargeFolder",
      },
    }));

    render(<DialogContainer />);

    expect(screen.getByText("File Information")).toBeInTheDocument();
    expect(screen.getByText("Calculating...")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetDirSize).toHaveBeenCalledWith("/home/user/LargeFolder");
    });
    await waitFor(() => {
      expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    });
  });

  it("creates a directory in the active panel path", async () => {
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "mkdir",
    }));

    render(<DialogContainer />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "New Folder" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() => {
      expect(mockCreateDirectory).toHaveBeenCalledWith("/home/user/New Folder");
    });
    expect(mockRefreshPanelsForDirectories).toHaveBeenCalledWith(["/home/user"]);
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("creates a file in the active panel path", async () => {
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "newfile",
    }));

    render(<DialogContainer />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "notes.txt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() => {
      expect(mockCreateFile).toHaveBeenCalledWith("/home/user/notes.txt");
    });
    expect(mockRefreshPanelsForDirectories).toHaveBeenCalledWith(["/home/user"]);
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("renames the selected target within its parent directory", async () => {
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "rename",
      dialogTarget: {
        panelId: "left",
        path: "/home/user/old.txt",
      },
    }));

    render(<DialogContainer />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "new.txt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => {
      expect(mockRenameFile).toHaveBeenCalledWith(
        "/home/user/old.txt",
        "/home/user/new.txt"
      );
    });
    expect(mockRefreshPanelsForDirectories).toHaveBeenCalledWith(["/home/user"]);
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("computes the rename selection range for regular files", () => {
    expect(getRenameSelectionEnd("abc.txt")).toBe(3);
    expect(getRenameSelectionEnd("archive.tar.gz")).toBe("archive.tar".length);
  });

  it("computes the rename selection range for files without extensions", () => {
    expect(getRenameSelectionEnd("README")).toBe("README".length);
  });

  it("computes the rename selection range for dotfiles", () => {
    expect(getRenameSelectionEnd(".gitignore")).toBe(".gitignore".length);
  });

  it("selects the full name for directories even when they contain dots", () => {
    expect(getRenameSelectionEnd("project.assets", "directory")).toBe("project.assets".length);
  });

  it("preselects the basename when the rename dialog opens", async () => {
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "rename",
      dialogTarget: {
        panelId: "left",
        path: "/home/user/abc.txt",
      },
    }));

    render(<DialogContainer />);

    const input = screen.getByRole("textbox") as HTMLInputElement;

    await waitFor(() => {
      expect(input.value).toBe("abc.txt");
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(3);
      expect(input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)).toBe("abc");
    });
  });

  it("keeps the basename selected after deferred focus work runs", async () => {
    const focusSpy = vi
      .spyOn(HTMLInputElement.prototype, "focus")
      .mockImplementation(function focusWithDeferredCursorMove(this: HTMLInputElement) {
        setTimeout(() => {
          this.setSelectionRange(this.value.length, this.value.length);
        }, 0);
      });

    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "rename",
      dialogTarget: {
        panelId: "left",
        path: "/home/user/abc.txt",
      },
    }));

    render(<DialogContainer />);

    const input = screen.getByRole("textbox") as HTMLInputElement;

    try {
      await waitFor(() => {
        expect(input.value).toBe("abc.txt");
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      await waitFor(() => {
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe(3);
        expect(input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)).toBe("abc");
      });
    } finally {
      focusSpy.mockRestore();
    }
  });

  it("prevents Radix autofocus from selecting the whole filename", async () => {
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");

    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "rename",
      dialogTarget: {
        panelId: "left",
        path: "/home/user/abc.txt",
      },
    }));

    render(<DialogContainer />);

    const input = screen.getByRole("textbox") as HTMLInputElement;

    try {
      await waitFor(() => {
        expect(input.value).toBe("abc.txt");
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(selectSpy).not.toHaveBeenCalled();
      expect(input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)).toBe("abc");
    } finally {
      selectSpy.mockRestore();
    }
  });

  it("preselects the full dotted directory name when the rename dialog opens", async () => {
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "rename",
      dialogTarget: {
        panelId: "left",
        path: "/home/user/project.assets",
        entry: {
          name: "project.assets",
          path: "/home/user/project.assets",
          kind: "directory",
        },
      },
    }));

    render(<DialogContainer />);

    const input = screen.getByRole("textbox") as HTMLInputElement;

    await waitFor(() => {
      expect(input.value).toBe("project.assets");
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe("project.assets".length);
    });
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

  it("uses clipboard paths in paste-mode copy and queues keep-both on conflict", async () => {
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: "right",
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/target",
        resolvedPath: "/target",
      },
    }));
    useClipboardStore.setState({
      clipboard: {
        paths: ["/source/file.txt"],
        operation: "copy",
        sourcePanel: "left",
      },
    });
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "copy",
      dragCopyRequest: null,
      isPasteMode: true,
    }));
    mockCheckCopyConflicts.mockResolvedValue(["file.txt"]);
    mockSubmitJob.mockResolvedValue({
      id: "job-5",
      kind: "copy",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });

    render(<DialogContainer />);

    expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
    expect(screen.getByText('"file.txt"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ["/source/file.txt"],
        "/target"
      );
    });
    await waitFor(() => {
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: "copy",
        sourcePaths: ["/source/file.txt"],
        targetPath: "/target",
        keepBoth: true,
      });
    });
    expect(screen.queryByText("Files Already Exist")).not.toBeInTheDocument();
    expect(useClipboardStore.getState().clipboard).toEqual({
      paths: ["/source/file.txt"],
      operation: "copy",
      sourcePanel: "left",
    });
  });

  it("clears the cut clipboard after a paste-mode move completes", async () => {
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: "right",
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/target",
        resolvedPath: "/target",
      },
    }));
    useClipboardStore.setState({
      clipboard: {
        paths: ["/source/file.txt"],
        operation: "cut",
        sourcePanel: "left",
      },
    });
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "move",
      dragCopyRequest: null,
      isPasteMode: true,
    }));
    mockSubmitJob.mockResolvedValue({
      id: "job-6",
      kind: "move",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });

    render(<DialogContainer />);

    expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
    expect(screen.getByText('"file.txt"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => {
      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ["/source/file.txt"],
        "/target"
      );
    });
    await waitFor(() => {
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: "move",
        sourcePaths: ["/source/file.txt"],
        targetDir: "/target",
      });
    });
    expect(useClipboardStore.getState().clipboard).toBeNull();
  });
});
