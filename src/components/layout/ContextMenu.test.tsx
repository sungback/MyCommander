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
  mockSetEntrySizeStatus,
  mockUpdateEntrySize,
  mockSetActivePanel,
  mockSubmitJob,
  mockGetDirSize,
  mockRenameFile,
  mockOpenInTerminal,
  mockRevealItemInDir,
  mockExtractZip,
  mockWriteClipboardText,
  mockCloseContextMenu,
  mockShowTransientToast,
} = vi.hoisted(() => ({
  listenHandlers: new Map<string, (event: { payload: string }) => void | Promise<void>>(),
  mockSetOpenDialog: vi.fn(),
  mockOpenRenameDialog: vi.fn(),
  mockOpenInfoDialog: vi.fn(),
  mockCloseDialog: vi.fn(),
  mockRefreshPanel: vi.fn(),
  mockSetEntrySizeStatus: vi.fn(),
  mockUpdateEntrySize: vi.fn(),
  mockSetActivePanel: vi.fn(),
  mockSubmitJob: vi.fn(),
  mockGetDirSize: vi.fn(),
  mockRenameFile: vi.fn(),
  mockOpenInTerminal: vi.fn(),
  mockRevealItemInDir: vi.fn(),
  mockExtractZip: vi.fn(),
  mockWriteClipboardText: vi.fn(),
  mockCloseContextMenu: vi.fn(),
  mockShowTransientToast: vi.fn(),
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
      {
        name: "머신.txt".normalize("NFD"),
        path: `/home/user/${"머신.txt".normalize("NFD")}`,
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
  setEntrySizeStatus: mockSetEntrySizeStatus,
  updateEntrySize: mockUpdateEntrySize,
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

vi.mock("../../store/toastStore", () => ({
  showTransientToast: mockShowTransientToast,
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    extractZip: mockExtractZip,
    getDirSize: mockGetDirSize,
    openInTerminal: mockOpenInTerminal,
    renameFile: mockRenameFile,
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
    mockExtractZip.mockResolvedValue(undefined);
    mockGetDirSize.mockResolvedValue(42);
    mockOpenInTerminal.mockResolvedValue(undefined);
    mockRenameFile.mockResolvedValue(undefined);
    mockRevealItemInDir.mockResolvedValue(undefined);
    mockWriteClipboardText.mockResolvedValue(undefined);
    mockContextState.panelId = "left";
    mockContextState.targetPath = "/home/user/Documents";
    mockPanelState.leftPanel.selectedItems = new Set<string>();
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
    expect(mockShowTransientToast).toHaveBeenCalledWith("압축 작업이 대기열에 추가되었습니다.");
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
    expect(mockShowTransientToast).toHaveBeenCalledWith("경로를 복사했습니다.");
  });

  it("NFD 파일명을 NFC로 변환한다", async () => {
    const nfdName = "머신.txt".normalize("NFD");
    mockContextState.targetPath = `/home/user/${nfdName}`;

    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "normalize-filename-nfc" });

    expect(mockRenameFile).toHaveBeenCalledWith(
      `/home/user/${nfdName}`,
      "/home/user/머신.txt"
    );
    expect(mockRefreshPanel).toHaveBeenCalledWith("left");
    expect(mockShowTransientToast).toHaveBeenCalledWith("파일명을 NFC로 변환했습니다.");
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("NFC 변환 실패 시 오류 토스트를 표시한다", async () => {
    const nfdName = "머신.txt".normalize("NFD");
    mockContextState.targetPath = `/home/user/${nfdName}`;
    mockRenameFile.mockRejectedValueOnce(new Error("rename failed"));

    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "normalize-filename-nfc" });

    expect(mockShowTransientToast).toHaveBeenCalledWith(
      "파일명을 NFC로 변환하지 못했습니다.",
      { tone: "error" }
    );
  });

  it("info 액션을 처리한다", async () => {
    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "info" });

    expect(mockSetActivePanel).toHaveBeenCalledWith("left");
    expect(mockOpenInfoDialog).toHaveBeenCalledWith({
      panelId: "left",
      path: "/home/user/Documents",
      entry: expect.objectContaining({ name: "Documents" }),
    });
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("reveal 액션을 처리한다", async () => {
    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "reveal" });

    expect(mockRevealItemInDir).toHaveBeenCalledWith("/home/user/Documents");
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("terminal 액션을 처리한다", async () => {
    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "terminal" });

    expect(mockOpenInTerminal).toHaveBeenCalledWith("/home/user/Documents");
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("calculate-size 액션은 대상 폴더 용량을 계산해 패널 항목을 갱신한다", async () => {
    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "calculate-size" });

    expect(mockSetActivePanel).toHaveBeenCalledWith("left");
    expect(mockSetEntrySizeStatus).toHaveBeenCalledWith(
      "left",
      "/home/user/Documents",
      "calculating"
    );
    expect(mockGetDirSize).toHaveBeenCalledWith("/home/user/Documents");
    expect(mockUpdateEntrySize).toHaveBeenCalledWith(
      "left",
      "/home/user/Documents",
      42
    );
    expect(mockShowTransientToast).toHaveBeenCalledWith("Documents: 42 B");
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("extract-zip 액션을 처리한다", async () => {
    mockContextState.targetPath = "/home/user/notes.txt";

    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "extract-zip" });

    expect(mockSetActivePanel).toHaveBeenCalledWith("left");
    expect(mockExtractZip).toHaveBeenCalledWith("/home/user/notes.txt");
    expect(mockRefreshPanel).toHaveBeenCalledWith("left");
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("rename 액션을 처리한다", async () => {
    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "rename" });

    expect(mockSetActivePanel).toHaveBeenCalledWith("left");
    expect(mockOpenRenameDialog).toHaveBeenCalledWith({
      panelId: "left",
      path: "/home/user/Documents",
      entry: expect.objectContaining({ name: "Documents" }),
    });
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("refresh 액션을 처리한다", async () => {
    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "refresh" });

    expect(mockRefreshPanel).toHaveBeenCalledWith("left");
    expect(mockCloseContextMenu).toHaveBeenCalled();
  });

  it("reveal 실패 시 오류 토스트를 표시한다", async () => {
    mockRevealItemInDir.mockRejectedValueOnce(new Error("not found"));

    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "reveal" });

    expect(mockShowTransientToast).toHaveBeenCalledWith(
      "항목 위치를 열 수 없습니다.",
      { tone: "error" }
    );
  });

  it("terminal 실패 시 오류 토스트를 표시한다", async () => {
    mockOpenInTerminal.mockRejectedValueOnce(new Error("no terminal"));

    render(<ContextMenu />);

    await Promise.resolve();
    await listenHandlers.get("context-menu-action")?.({ payload: "terminal" });

    expect(mockShowTransientToast).toHaveBeenCalledWith(
      "터미널을 열 수 없습니다.",
      { tone: "error" }
    );
  });
});
