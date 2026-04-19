import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogContainer } from "./DialogContainer";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";

const {
  mockDeleteFiles,
  mockRefreshPanelsForDirectories,
  mockRefreshPanelsForEntryPaths,
  mockRemoveDeletedPathsFromVisiblePanels,
} = vi.hoisted(() => ({
  mockDeleteFiles: vi.fn(),
  mockRefreshPanelsForDirectories: vi.fn(),
  mockRefreshPanelsForEntryPaths: vi.fn(),
  mockRemoveDeletedPathsFromVisiblePanels: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    createDirectory: vi.fn(),
    createFile: vi.fn(),
    renameFile: vi.fn(),
    deleteFiles: mockDeleteFiles,
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    checkCopyConflicts: vi.fn().mockResolvedValue([]),
    getDirSize: vi.fn().mockResolvedValue(0),
  }),
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback,
}));

vi.mock("../../store/panelRefresh", () => ({
  refreshPanelsForDirectories: mockRefreshPanelsForDirectories,
  refreshPanelsForEntryPaths: mockRefreshPanelsForEntryPaths,
  removeDeletedPathsFromVisiblePanels: mockRemoveDeletedPathsFromVisiblePanels,
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
    mockDeleteFiles.mockReset();
    mockRefreshPanelsForDirectories.mockReset();
    mockRefreshPanelsForEntryPaths.mockReset();
    mockRemoveDeletedPathsFromVisiblePanels.mockReset();
  });

  it("switches to the progress dialog while deleting and refreshes deleted parent entries", async () => {
    let resolveDelete: (() => void) | undefined;
    mockDeleteFiles.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );

    render(<DialogContainer />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(mockDeleteFiles).toHaveBeenCalledWith(["/home/user/LargeFolder"], false);
    expect(useDialogStore.getState().openDialog).toBe("progress");

    resolveDelete?.();

    await waitFor(() => {
      expect(useDialogStore.getState().openDialog).toBeNull();
    });

    expect(mockRemoveDeletedPathsFromVisiblePanels).toHaveBeenCalledWith([
      "/home/user/LargeFolder",
    ]);
    expect(mockRefreshPanelsForEntryPaths).toHaveBeenCalledWith(["/home/user/LargeFolder"]);
  });
});
