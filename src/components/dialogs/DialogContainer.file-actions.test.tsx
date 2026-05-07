import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  mockCreateDirectory,
  mockCreateFile,
  mockGetDirSize,
  mockRefreshPanelsForDirectories,
  mockRenameFile,
  mockSubmitJob,
  registerDialogContainerTestLifecycle,
} from './DialogContainer.test-harness';
import { DialogContainer, getRenameSelectionEnd } from './DialogContainer';
import { useDialogStore } from '../../store/dialogStore';

describe('DialogContainer', () => {
  registerDialogContainerTestLifecycle();

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
});
