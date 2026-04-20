import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogContainer } from "./DialogContainer";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";

const {
  mockSubmitJob,
} = vi.hoisted(() => ({
  mockSubmitJob: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    createDirectory: vi.fn(),
    createFile: vi.fn(),
    renameFile: vi.fn(),
    submitJob: mockSubmitJob,
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    checkCopyConflicts: vi.fn().mockResolvedValue([]),
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
  showTransientStatusMessage: vi.fn(),
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
