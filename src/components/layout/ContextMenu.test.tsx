import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ContextMenu } from "./ContextMenu";
import { useJobStore } from "../../store/jobStore";

const {
  listenHandlers,
  mockSetOpenDialog,
  mockOpenRenameDialog,
  mockOpenInfoDialog,
  mockCloseDialog,
  mockRefreshPanel,
  mockSetActivePanel,
  mockSubmitJob,
  mockOpenInTerminal,
  mockRevealItemInDir,
  mockWriteClipboardText,
  mockCloseContextMenu,
  mockSetStatusMessage,
} = vi.hoisted(() => ({
  listenHandlers: new Map<string, (event: { payload: string }) => void | Promise<void>>(),
  mockSetOpenDialog: vi.fn(),
  mockOpenRenameDialog: vi.fn(),
  mockOpenInfoDialog: vi.fn(),
  mockCloseDialog: vi.fn(),
  mockRefreshPanel: vi.fn(),
  mockSetActivePanel: vi.fn(),
  mockSubmitJob: vi.fn(),
  mockOpenInTerminal: vi.fn(),
  mockRevealItemInDir: vi.fn(),
  mockWriteClipboardText: vi.fn(),
  mockCloseContextMenu: vi.fn(),
  mockSetStatusMessage: vi.fn(),
}));

const mockContextState = {
  panelId: "left" as const,
  targetPath: "/home/user/Documents",
  closeContextMenu: mockCloseContextMenu,
};

const mockPanelState = {
  leftPanel: {
    currentPath: "/home/user",
    selectedItems: new Set<string>(),
    files: [
      {
        name: "Documents",
        path: "/home/user/Documents",
        kind: "directory",
        size: null,
        lastModified: null,
        isHidden: false,
      },
      {
        name: "notes.txt",
        path: "/home/user/notes.txt",
        kind: "file",
        size: 12,
        lastModified: null,
        isHidden: false,
      },
    ],
  },
  rightPanel: {
    currentPath: "/home/other",
    selectedItems: new Set<string>(),
    files: [],
  },
  refreshPanel: mockRefreshPanel,
  setActivePanel: mockSetActivePanel,
};

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockImplementation(async (eventName: string, handler: (event: { payload: string }) => void | Promise<void>) => {
    listenHandlers.set(eventName, handler);
    return () => {
      listenHandlers.delete(eventName);
    };
  }),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: mockRevealItemInDir,
}));

vi.mock("../../utils/clipboard", () => ({
  writeClipboardText: mockWriteClipboardText,
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    openInTerminal: mockOpenInTerminal,
    submitJob: mockSubmitJob,
  }),
}));

vi.mock("../../store/contextMenuStore", () => ({
  useContextMenuStore: Object.assign(
    (selector?: (state: typeof mockContextState) => unknown) =>
      selector ? selector(mockContextState) : mockContextState,
    {
      getState: () => mockContextState,
    }
  ),
}));

vi.mock("../../store/dialogStore", () => ({
  useDialogStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) =>
      selector
        ? selector({
            setOpenDialog: mockSetOpenDialog,
            openRenameDialog: mockOpenRenameDialog,
            openInfoDialog: mockOpenInfoDialog,
            closeDialog: mockCloseDialog,
          })
        : null,
    {
      getState: () => ({
        setOpenDialog: mockSetOpenDialog,
        openRenameDialog: mockOpenRenameDialog,
        openInfoDialog: mockOpenInfoDialog,
        closeDialog: mockCloseDialog,
      }),
    }
  ),
}));

vi.mock("../../store/panelStore", () => ({
  usePanelStore: Object.assign(
    (selector?: (state: typeof mockPanelState) => unknown) =>
      selector ? selector(mockPanelState) : mockPanelState,
    {
      getState: () => mockPanelState,
    }
  ),
}));

vi.mock("../../store/uiStore", () => ({
  useUiStore: {
    getState: () => ({
      setStatusMessage: mockSetStatusMessage,
    }),
  },
}));

describe("ContextMenu", () => {
  beforeEach(() => {
    useJobStore.setState(useJobStore.getInitialState());
    vi.clearAllMocks();
    listenHandlers.clear();
    mockSubmitJob.mockResolvedValue({
      id: "job-1",
      kind: "zip",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      error: null,
      result: null,
    });
    mockOpenInTerminal.mockResolvedValue(undefined);
    mockRevealItemInDir.mockResolvedValue(undefined);
    mockWriteClipboardText.mockResolvedValue(undefined);
    mockContextState.panelId = "left";
    mockContextState.targetPath = "/home/user/Documents";
  });

  it("create-zip 액션을 처리한다", async () => {
    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "create-zip" });

    expect(mockSetActivePanel).toHaveBeenCalledWith("left");
    expect(mockSubmitJob).toHaveBeenCalledWith({
      kind: "zipDirectory",
      path: "/home/user/Documents",
    });
    expect(useJobStore.getState().jobs[0]?.id).toBe("job-1");
    expect(mockSetOpenDialog).toHaveBeenCalledWith("progress");
    expect(mockSetStatusMessage).toHaveBeenCalledWith("압축 작업이 대기열에 추가되었습니다.");
    expect(mockRefreshPanel).toHaveBeenCalledWith("left");
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("다중 선택 create-zip 액션은 zipSelection job을 제출한다", async () => {
    mockPanelState.leftPanel.selectedItems = new Set<string>([
      "/home/user/Documents",
      "/home/user/notes.txt",
    ]);

    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "create-zip" });

    expect(mockSubmitJob).toHaveBeenCalledWith({
      kind: "zipSelection",
      paths: ["/home/user/Documents", "/home/user/notes.txt"],
      targetDir: "/home/user",
      archiveName: "user",
    });
    expect(useJobStore.getState().jobs[0]?.kind).toBe("zip");
  });

  it("delete 액션을 처리한다", async () => {
    mockContextState.targetPath = "/home/user/notes.txt";

    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "delete" });

    expect(mockSetActivePanel).toHaveBeenCalledWith("left");
    expect(mockSetOpenDialog).toHaveBeenCalledWith("delete");
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("copy-path 액션을 처리한다", async () => {
    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "copy-path" });

    expect(mockWriteClipboardText).toHaveBeenCalledWith("/home/user/Documents");
    expect(mockSetStatusMessage).toHaveBeenCalledWith("경로를 복사했습니다.");
  });
});
