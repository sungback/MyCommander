import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  mockCheckCopyConflicts,
  mockSubmitJob,
  registerDialogContainerTestLifecycle,
} from './DialogContainer.test-harness';
import { DialogContainer } from './DialogContainer';
import { useClipboardStore } from '../../store/clipboardStore';
import { useDialogStore } from '../../store/dialogStore';
import { usePanelStore } from '../../store/panelStore';

describe('DialogContainer', () => {
  registerDialogContainerTestLifecycle();

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
