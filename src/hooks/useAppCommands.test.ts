import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppCommands } from "./useAppCommands";
import { usePanelStore } from "../store/panelStore";
import { useClipboardStore } from "../store/clipboardStore";
import { useDialogStore } from "../store/dialogStore";

const mockWriteFilesToPasteboard = vi.fn().mockResolvedValue(undefined);

vi.mock("./useFileSystem", () => ({
  useFileSystem: () => ({
    writeFilesToPasteboard: mockWriteFilesToPasteboard,
    openInEditor: vi.fn().mockResolvedValue(undefined),
    quitApp: vi.fn().mockResolvedValue(undefined),
    runShellCommand: vi.fn().mockResolvedValue(undefined),
    syncWatchedDirectories: vi.fn().mockResolvedValue(undefined),
    listJobs: vi.fn().mockResolvedValue([]),
  }),
  getErrorMessage: (_e: unknown, fallback: string) => fallback,
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
