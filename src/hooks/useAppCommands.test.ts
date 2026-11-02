import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppCommands } from "./useAppCommands";
import { usePanelStore } from "../store/panelStore";
import { useClipboardStore } from "../store/clipboardStore";
import { useDialogStore } from "../store/dialogStore";

const mockWriteFilesToPasteboard = vi.fn().mockResolvedValue(undefined);
const { mockRenameFile, mockRefreshPanelsForDirectories, mockShowTransientToast } = vi.hoisted(
  () => ({
    mockRenameFile: vi.fn(),
    mockRefreshPanelsForDirectories: vi.fn(),
    mockShowTransientToast: vi.fn(),
  })
);

vi.mock("./useFileSystem", () => ({
  useFileSystem: () => ({
    writeFilesToPasteboard: mockWriteFilesToPasteboard,
    renameFile: mockRenameFile,
    openInEditor: vi.fn().mockResolvedValue(undefined),
    quitApp: vi.fn().mockResolvedValue(undefined),
    runShellCommand: vi.fn().mockResolvedValue(undefined),
    syncWatchedDirectories: vi.fn().mockResolvedValue(undefined),
    listJobs: vi.fn().mockResolvedValue([]),
  }),
  getErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("../store/panelRefresh", () => ({
  refreshPanelsForDirectories: mockRefreshPanelsForDirectories,
}));

vi.mock("../store/toastStore", () => ({
  showTransientToast: mockShowTransientToast,
}));

vi.mock("../utils/clipboard", () => ({
  writeClipboardText: vi.fn().mockResolvedValue(undefined),
}));

// ── syncOtherPanelToCurrentPath ───────────────────────────────────────────────

describe("useAppCommands — syncOtherPanelToCurrentPath", () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
  });

  it("활성 패널 경로를 반대 패널에 복제한다", () => {
    const { result } = renderHook(() => useAppCommands());

    usePanelStore.getState().setPath("left", "/source");
    usePanelStore.getState().setPath("right", "/target");
    usePanelStore.getState().setActivePanel("left");

    result.current.syncOtherPanelToCurrentPath();

    const state = usePanelStore.getState();
    expect(state.leftPanel.currentPath).toBe("/source");
    expect(state.rightPanel.currentPath).toBe("/source");
  });

  it("명시한 원본 패널 기준으로 반대 패널을 동기화한다", () => {
    const { result } = renderHook(() => useAppCommands());

    usePanelStore.getState().setPath("left", "/left-source");
    usePanelStore.getState().setPath("right", "/right-source");
    usePanelStore.getState().setActivePanel("right");

    result.current.syncOtherPanelToCurrentPath("left");

    const state = usePanelStore.getState();
    expect(state.leftPanel.currentPath).toBe("/left-source");
    expect(state.rightPanel.currentPath).toBe("/left-source");
  });

  it("이미 같은 경로면 패널 상태를 다시 만들지 않는다", () => {
    const { result } = renderHook(() => useAppCommands());

    usePanelStore.getState().setPath("left", "/shared");
    usePanelStore.getState().setPath("right", "/shared");

    const beforeRightPanel = usePanelStore.getState().rightPanel;

    result.current.syncOtherPanelToCurrentPath("left");

    expect(usePanelStore.getState().rightPanel).toBe(beforeRightPanel);
  });

  it("resolvedPath가 같으면 다시 동기화하지 않는다", () => {
    const { result } = renderHook(() => useAppCommands());

    usePanelStore.getState().setPath("left", "/Users/back/Dropbox");
    usePanelStore
      .getState()
      .setResolvedPath("left", "/Users/back/Library/CloudStorage/Dropbox");
    usePanelStore.getState().setPath("right", "/Users/back/Library/CloudStorage/Dropbox");

    const beforeRightPanel = usePanelStore.getState().rightPanel;

    result.current.syncOtherPanelToCurrentPath("left");

    expect(usePanelStore.getState().rightPanel).toBe(beforeRightPanel);
  });
});

// ── swapPanels ────────────────────────────────────────────────────────────────

describe("useAppCommands — swapPanels", () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
  });

  it("좌/우 패널 경로를 서로 교환한다", () => {
    usePanelStore.getState().setPath("left", "/left-path");
    usePanelStore.getState().setPath("right", "/right-path");

    const { result } = renderHook(() => useAppCommands());
    result.current.swapPanels();

    const state = usePanelStore.getState();
    expect(state.leftPanel.currentPath).toBe("/right-path");
    expect(state.rightPanel.currentPath).toBe("/left-path");
  });
});

// ── copyCurrentPath ───────────────────────────────────────────────────────────

describe("useAppCommands — copyCurrentPath", () => {
  beforeEach(async () => {
    usePanelStore.setState(usePanelStore.getInitialState());
    vi.clearAllMocks();
    const { writeClipboardText } = await import("../utils/clipboard");
    vi.mocked(writeClipboardText).mockResolvedValue(undefined);
  });

  it("활성 패널의 currentPath를 클립보드에 복사한다", async () => {
    usePanelStore.getState().setPath("left", "/home/user");
    usePanelStore.getState().setActivePanel("left");

    const { result } = renderHook(() => useAppCommands());
    await result.current.copyCurrentPath();

    const { writeClipboardText } = await import("../utils/clipboard");
    expect(vi.mocked(writeClipboardText)).toHaveBeenCalledWith("/home/user");
  });

  it("패널 id를 명시하면 해당 패널 경로를 복사한다", async () => {
    usePanelStore.getState().setPath("right", "/right-path");
    usePanelStore.getState().setActivePanel("left");

    const { result } = renderHook(() => useAppCommands());
    await result.current.copyCurrentPath("right");

    const { writeClipboardText } = await import("../utils/clipboard");
    expect(vi.mocked(writeClipboardText)).toHaveBeenCalledWith("/right-path");
  });
});

// ── copyToClipboard / cutToClipboard ─────────────────────────────────────────

describe("useAppCommands — copyToClipboard / cutToClipboard", () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
    useClipboardStore.setState({ clipboard: null });
    mockWriteFilesToPasteboard.mockClear();
  });

  it("copyToClipboard: 선택 항목을 copy 클립보드에 저장한다", async () => {
    usePanelStore.getState().setPath("left", "/home");
    usePanelStore.setState((s) => ({
      ...s,
      leftPanel: {
        ...s.leftPanel,
        files: [
          { name: "..", path: "/", kind: "directory" },
          { name: "a.txt", path: "/home/a.txt", kind: "file" },
        ],
        selectedItems: new Set(["/home/a.txt"]),
      },
      activePanel: "left",
    }));

    const { result } = renderHook(() => useAppCommands());
    await result.current.copyToClipboard();

    const clip = useClipboardStore.getState().clipboard;
    expect(clip?.operation).toBe("copy");
    expect(clip?.paths).toEqual(["/home/a.txt"]);
  });

  it("cutToClipboard: 선택 항목을 cut 클립보드에 저장한다", async () => {
    usePanelStore.setState((s) => ({
      ...s,
      leftPanel: {
        ...s.leftPanel,
        files: [
          { name: "..", path: "/", kind: "directory" },
          { name: "b.txt", path: "/home/b.txt", kind: "file" },
        ],
        selectedItems: new Set(["/home/b.txt"]),
      },
      activePanel: "left",
    }));

    const { result } = renderHook(() => useAppCommands());
    await result.current.cutToClipboard();

    const clip = useClipboardStore.getState().clipboard;
    expect(clip?.operation).toBe("cut");
    expect(clip?.paths).toEqual(["/home/b.txt"]);
  });
});

// ── pasteFromClipboard ────────────────────────────────────────────────────────

describe("useAppCommands — pasteFromClipboard", () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
    useClipboardStore.setState({ clipboard: null });
    useDialogStore.setState(useDialogStore.getInitialState());
  });

  it("clipboard가 없으면 아무것도 하지 않는다", () => {
    const { result } = renderHook(() => useAppCommands());
    result.current.pasteFromClipboard();
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("copy 클립보드이면 copy 다이얼로그를 연다", () => {
    useClipboardStore.setState({
      clipboard: { paths: ["/src/a.txt"], operation: "copy", sourcePanel: "left" },
    });
    usePanelStore.getState().setPath("right", "/dst");
    usePanelStore.getState().setActivePanel("right");

    const { result } = renderHook(() => useAppCommands());
    result.current.pasteFromClipboard();

    expect(useDialogStore.getState().openDialog).toBe("copy");
  });

  it("cut 클립보드이면 move 다이얼로그를 연다", () => {
    useClipboardStore.setState({
      clipboard: { paths: ["/src/a.txt"], operation: "cut", sourcePanel: "left" },
    });
    usePanelStore.getState().setPath("right", "/dst");
    usePanelStore.getState().setActivePanel("right");

    const { result } = renderHook(() => useAppCommands());
    result.current.pasteFromClipboard();

    expect(useDialogStore.getState().openDialog).toBe("move");
  });

  it("cut이고 원본과 같은 폴더면 다이얼로그를 열지 않는다", () => {
    useClipboardStore.setState({
      clipboard: {
        paths: ["/same/a.txt"],
        operation: "cut",
        sourcePanel: "left",
      },
    });
    usePanelStore.getState().setPath("left", "/same");
    usePanelStore.getState().setActivePanel("left");

    const { result } = renderHook(() => useAppCommands());
    result.current.pasteFromClipboard();

    expect(useDialogStore.getState().openDialog).toBeNull();
  });
});

// ── normalizeSelectionToNfc ───────────────────────────────────────────────────

describe("useAppCommands — normalizeSelectionToNfc", () => {
  const nfd = (text: string) => text.normalize("NFD");

  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
    mockRenameFile.mockReset();
    mockRenameFile.mockResolvedValue(undefined);
    mockRefreshPanelsForDirectories.mockClear();
    mockShowTransientToast.mockClear();
  });

  it("선택한 항목 전체를 NFC로 바꾸고 폴더를 갱신한다", async () => {
    const first = `/work/${nfd("가나.txt")}`;
    const second = `/work/${nfd("다라.txt")}`;
    usePanelStore.getState().setSelection("left", [first, second, "/work/plain.txt"]);
    const { result } = renderHook(() => useAppCommands());

    await result.current.normalizeSelectionToNfc();

    expect(mockRenameFile).toHaveBeenCalledTimes(2);
    expect(mockRenameFile).toHaveBeenCalledWith(first, "/work/가나.txt");
    expect(mockRenameFile).toHaveBeenCalledWith(second, "/work/다라.txt");
    expect(mockRefreshPanelsForDirectories).toHaveBeenCalledWith(["/work"]);
    expect(mockShowTransientToast).toHaveBeenCalledWith("2개 파일명을 NFC로 변환했습니다.", {
      tone: "info",
    });
  });

  it("선택이 없으면 커서 항목을 바꾼다", async () => {
    const entryPath = `/work/${nfd("머신.txt")}`;
    usePanelStore.getState().setFiles("left", [
      { name: nfd("머신.txt"), path: entryPath, kind: "file" },
    ]);
    usePanelStore.getState().setCursor("left", 0);
    const { result } = renderHook(() => useAppCommands());

    await result.current.normalizeSelectionToNfc();

    expect(mockRenameFile).toHaveBeenCalledWith(entryPath, "/work/머신.txt");
  });

  it("대상이 없으면 이름을 바꾸지 않고 알린다", async () => {
    const { result } = renderHook(() => useAppCommands());

    await result.current.normalizeSelectionToNfc();

    expect(mockRenameFile).not.toHaveBeenCalled();
    expect(mockShowTransientToast).toHaveBeenCalledWith("변환할 항목이 없습니다", {
      durationMs: 1400,
    });
  });
});
