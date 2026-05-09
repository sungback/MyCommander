import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogStore } from "../../store/dialogStore";
import { useJobStore } from "../../store/jobStore";
import { usePanelStore } from "../../store/panelStore";
import { CommandPalette } from "./CommandPalette";

const commandPaletteMocks = vi.hoisted(() => ({
  mockOpenInTerminal: vi.fn(),
  mockSubmitJob: vi.fn(),
  mockExtractZip: vi.fn(),
  mockOpenInEditor: vi.fn(),
  mockRefreshPanelsForDirectories: vi.fn(),
  mockShowTransientToast: vi.fn(),
}));

const mockOpenInTerminal = commandPaletteMocks.mockOpenInTerminal;
const mockSubmitJob = commandPaletteMocks.mockSubmitJob;
const mockExtractZip = commandPaletteMocks.mockExtractZip;

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    extractZip: commandPaletteMocks.mockExtractZip,
    openInEditor: commandPaletteMocks.mockOpenInEditor,
    openInTerminal: commandPaletteMocks.mockOpenInTerminal,
    submitJob: commandPaletteMocks.mockSubmitJob,
  }),
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback,
}));

vi.mock("../../store/panelRefresh", () => ({
  refreshPanelsForDirectories: commandPaletteMocks.mockRefreshPanelsForDirectories,
}));

vi.mock("../../store/toastStore", () => ({
  showTransientToast: commandPaletteMocks.mockShowTransientToast,
}));

const openPalette = () => {
  useDialogStore.getState().setOpenDialog("commandPalette");
  render(<CommandPalette />);
};

const seedPanel = () => {
  usePanelStore.setState((state) => ({
    ...state,
    activePanel: "left",
    showHiddenFiles: false,
    leftPanel: {
      ...state.leftPanel,
      currentPath: "/home/user",
      resolvedPath: "/resolved/user",
      files: [
        { name: "..", path: "/home", kind: "directory" },
        { name: "notes.txt", path: "/resolved/user/notes.txt", kind: "file" },
        { name: "archive.zip", path: "/resolved/user/archive.zip", kind: "file" },
      ],
      selectedItems: new Set<string>(["/resolved/user/notes.txt"]),
      cursorIndex: 1,
    },
  }));
};

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDialogStore.setState(useDialogStore.getInitialState());
    usePanelStore.setState(usePanelStore.getInitialState());
    useJobStore.getState().resetJobs();
    mockSubmitJob.mockResolvedValue({
      id: "job-1",
      kind: "zip",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 1, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });
    mockExtractZip.mockResolvedValue("/resolved/user/archive");
    seedPanel();
  });

  it("filters commands and opens an existing dialog", () => {
    openPalette();

    fireEvent.change(screen.getByRole("combobox", { name: "Command" }), {
      target: { value: "new folder" },
    });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Command" }), {
      key: "Enter",
    });

    expect(useDialogStore.getState().openDialog).toBe("mkdir");
  });

  it("does not run disabled commands", () => {
    usePanelStore.setState((state) => ({
      ...state,
      leftPanel: {
        ...state.leftPanel,
        selectedItems: new Set<string>(),
        cursorIndex: 0,
      },
    }));
    openPalette();

    fireEvent.change(screen.getByRole("combobox", { name: "Command" }), {
      target: { value: "copy selected" },
    });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Command" }), {
      key: "Enter",
    });

    expect(useDialogStore.getState().openDialog).toBe("commandPalette");
    expect(screen.getAllByText("No files selected").length).toBeGreaterThan(0);
  });

  it("runs the terminal command against the resolved active panel path", async () => {
    openPalette();

    fireEvent.change(screen.getByRole("combobox", { name: "Command" }), {
      target: { value: "terminal" },
    });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Command" }), {
      key: "Enter",
    });

    await waitFor(() => {
      expect(mockOpenInTerminal).toHaveBeenCalledWith("/resolved/user");
    });
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("queues a ZIP job from selected files", async () => {
    openPalette();

    fireEvent.change(screen.getByRole("combobox", { name: "Command" }), {
      target: { value: "create zip" },
    });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Command" }), {
      key: "Enter",
    });

    await waitFor(() => {
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: "zipSelection",
        paths: ["/resolved/user/notes.txt"],
        targetDir: "/resolved/user",
        archiveName: "user",
      });
    });
    expect(useDialogStore.getState().openDialog).toBe("progress");
  });
});
