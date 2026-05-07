import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  mockCheckCopyConflicts,
  mockShowTransientStatusMessage,
  mockSubmitJob,
  registerDialogContainerTestLifecycle,
} from './DialogContainer.test-harness';
import { DialogContainer } from './DialogContainer';
import { useDialogStore } from '../../store/dialogStore';
import { usePanelStore } from '../../store/panelStore';

describe('DialogContainer', () => {
  registerDialogContainerTestLifecycle();

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
        overwrite: true,
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
        overwrite: true,
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
