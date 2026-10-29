import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  mockCreateDirectory,
  mockCreateFile,
  mockCancelDirSizeScan,
  mockScanDirSize,
  mockRefreshPanelsForDirectories,
  mockRenameFile,
  mockSubmitJob,
  registerDialogContainerTestLifecycle,
} from './DialogContainer.test-harness';
import { DialogContainer, getRenameSelectionEnd } from './DialogContainer';
import { useDialogStore } from '../../store/dialogStore';
import { useFileOperationUndoStore } from '../../store/fileOperationUndoStore';
import { useJobStore } from '../../store/jobStore';
import { usePanelStore } from '../../store/panelStore';

describe('DialogContainer', () => {
  registerDialogContainerTestLifecycle();

  it("loads folder size in the info dialog for directories without a cached size", async () => {
    mockScanDirSize.mockResolvedValue({
      size: 2048,
      isPartial: false,
      scannedEntries: 3,
      errorCount: 0,
      inaccessibleCount: 0,
      startedAtMs: 1,
    });
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
      expect(mockScanDirSize).toHaveBeenCalledWith(
        "/home/user/LargeFolder",
        expect.stringMatching(/^info-dir-size-left-/)
      );
    });
    await waitFor(() => {
      expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    });
    expect(usePanelStore.getState().sizeStatusCache["/home/user/LargeFolder"]).toBe("exact");
  });

  it("marks info dialog folder sizes with unreadable entries as lower bounds", async () => {
    mockScanDirSize.mockResolvedValue({
      size: 4096,
      isPartial: false,
      scannedEntries: 5,
      errorCount: 0,
      inaccessibleCount: 2,
      startedAtMs: 1,
    });
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "info",
      dialogTarget: {
        panelId: "left",
        path: "/home/user/LargeFolder",
      },
    }));

    render(<DialogContainer />);

    await waitFor(() => {
      expect(screen.getByText("≥4.0 KB")).toBeInTheDocument();
    });
    expect(screen.getByText("Excludes items without read permission.")).toBeInTheDocument();
    expect(usePanelStore.getState().sizeStatusCache["/home/user/LargeFolder"]).toBe("limited");
  });

  it("records child folder sizes from the info dialog scan", async () => {
    mockScanDirSize.mockResolvedValue({
      size: 4096,
      isPartial: false,
      scannedEntries: 5,
      errorCount: 0,
      inaccessibleCount: 0,
      startedAtMs: 1,
      children: [
        {
          path: "/home/user/LargeFolder/info-child",
          size: 300,
          isPartial: false,
          inaccessibleCount: 0,
          depth: 1,
        },
      ],
    });
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "info",
      dialogTarget: {
        panelId: "left",
        path: "/home/user/LargeFolder",
      },
    }));

    render(<DialogContainer />);

    await waitFor(() => {
      expect(usePanelStore.getState().sizeCache["/home/user/LargeFolder/info-child"]).toBe(300);
    });
  });

  it("cancels the info dialog folder scan when the dialog closes", async () => {
    mockScanDirSize.mockReturnValue(new Promise(() => undefined));
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "info",
      dialogTarget: {
        panelId: "left",
        path: "/home/user/LargeFolder",
      },
    }));

    render(<DialogContainer />);
    await waitFor(() => expect(mockScanDirSize).toHaveBeenCalled());
    const scanId = mockScanDirSize.mock.calls[0][1];

    act(() => {
      useDialogStore.setState((state) => ({ ...state, openDialog: null }));
    });

    await waitFor(() => expect(mockCancelDirSizeScan).toHaveBeenCalledWith(scanId));
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
    expect(useFileOperationUndoStore.getState().lastOperation).toEqual(
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
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("registers pending undo metadata when a move job is queued", async () => {
    mockSubmitJob.mockResolvedValue({
      id: "move-job-1",
      kind: "move",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: "left",
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/target",
        resolvedPath: "/target",
      },
    }));
    useDialogStore.setState((state) => ({
      ...state,
      openDialog: "move",
    }));

    render(<DialogContainer />);

    await waitFor(() => {
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
        "/target"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => {
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: "move",
        sourcePaths: ["/home/user/LargeFolder"],
        targetDir: "/target",
      });
    });
    expect(
      useFileOperationUndoStore.getState().pendingMoveOperations["move-job-1"]
    ).toEqual(
      expect.objectContaining({
        kind: "move",
        entries: [
          {
            originalPath: "/home/user/LargeFolder",
            currentPath: "/target/LargeFolder",
          },
        ],
      })
    );
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
    expect(useJobStore.getState().activeJob?.id).toBe("job-1");
    expect(useJobStore.getState().activeJob?.kind).toBe("delete");
  });
});
