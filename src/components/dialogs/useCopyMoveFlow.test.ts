import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCopyMoveFlow } from "./useCopyMoveFlow";
import type { DialogType } from "../../store/dialogStore";
import type { ClipboardState } from "../../store/clipboardStore";

const {
  mockResolveTargetPath,
  mockCheckCopyConflicts,
  mockSubmitJob,
  mockShowTransientStatusMessage,
  mockResolveConflictAction,
  mockFilterNonConflictingSourcePaths,
  mockClearClipboard,
  mockSetOpenDialog,
  mockOpenDragCopyDialog,
  mockCloseDialog,
} = vi.hoisted(() => ({
  mockResolveTargetPath: vi.fn().mockReturnValue("/target"),
  mockCheckCopyConflicts: vi.fn().mockResolvedValue([]),
  mockSubmitJob: vi.fn().mockResolvedValue(undefined),
  mockShowTransientStatusMessage: vi.fn(),
  mockResolveConflictAction: vi.fn(),
  mockFilterNonConflictingSourcePaths: vi.fn(),
  mockClearClipboard: vi.fn(),
  mockSetOpenDialog: vi.fn(),
  mockOpenDragCopyDialog: vi.fn(),
  mockCloseDialog: vi.fn(),
}));

vi.mock("./dialogTargetPath", () => ({
  resolveTargetPath: mockResolveTargetPath,
}));

vi.mock("../../hooks/useAppCommands", () => ({
  showTransientStatusMessage: mockShowTransientStatusMessage,
}));

vi.mock("./copyMoveConflict", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./copyMoveConflict")>();
  return {
    ...actual,
    resolveConflictAction: mockResolveConflictAction,
    filterNonConflictingSourcePaths: mockFilterNonConflictingSourcePaths,
  };
});

const makePanel = (path: string) => ({
  currentPath: path,
  resolvedPath: undefined as string | undefined,
  id: "left" as const,
  tabs: [],
  activeTabId: "",
  selectedItems: new Set<string>(),
  files: [],
  cursorIndex: 0,
  history: [path],
  historyIndex: 0,
  sortField: "name" as const,
  sortDirection: "asc" as const,
  lastUpdated: 0,
  pendingCursorName: null,
});

const defaultProps = () => ({
  openDialog: "copy" as DialogType,
  dragCopyRequest: null,
  dragCopyTargetPath: "",
  isPasteMode: false,
  activePanel: makePanel("/source"),
  targetPanel: makePanel("/target"),
  clipboard: null as ClipboardState | null,
  clearClipboard: mockClearClipboard,
  selectedPaths: ["/source/a.txt", "/source/b.txt"],
  inputValue: "/target",
  fs: {
    checkCopyConflicts: mockCheckCopyConflicts,
    submitJob: mockSubmitJob,
  } as unknown as ReturnType<typeof import("../../hooks/useFileSystem").useFileSystem>,
  setOpenDialog: mockSetOpenDialog,
  openDragCopyDialog: mockOpenDragCopyDialog,
  closeDialog: mockCloseDialog,
});

describe("useCopyMoveFlow", () => {
  let props: ReturnType<typeof defaultProps>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTargetPath.mockReturnValue("/target");
    mockCheckCopyConflicts.mockResolvedValue([]);
    mockSubmitJob.mockResolvedValue(undefined);
    mockResolveConflictAction.mockReturnValue(null);
    mockFilterNonConflictingSourcePaths.mockReturnValue([]);
    props = defaultProps();
  });

  describe("handleCopyMove — 복사", () => {
    it("충돌 없이 복사 job을 제출하고 progress 다이얼로그를 연다", async () => {
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleCopyMove(false);
      });
      expect(mockSetOpenDialog).toHaveBeenCalledWith("progress");
      expect(mockSubmitJob).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "copy", sourcePaths: props.selectedPaths })
      );
    });

    it("inputValue가 비어있으면 submitJob을 호출하지 않는다", async () => {
      props.inputValue = "";
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleCopyMove(false);
      });
      expect(mockSubmitJob).not.toHaveBeenCalled();
    });

    it("selectedPaths가 비어있으면 submitJob을 호출하지 않는다", async () => {
      props.selectedPaths = [];
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleCopyMove(false);
      });
      expect(mockSubmitJob).not.toHaveBeenCalled();
    });
  });

  describe("handleCopyMove — 이동", () => {
    it("이동 job을 제출하고 완료 토스트를 표시한다", async () => {
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleCopyMove(true);
      });
      expect(mockSubmitJob).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "move", sourcePaths: props.selectedPaths })
      );
      expect(mockShowTransientStatusMessage).toHaveBeenCalledWith(
        "이동 작업이 대기열에 추가되었습니다."
      );
    });
  });

  describe("handleCopyMove — 충돌 처리", () => {
    it("충돌이 있으면 conflictFiles를 설정하고 진행을 중단한다", async () => {
      mockCheckCopyConflicts.mockResolvedValue(["existing.txt"]);
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleCopyMove(false);
      });
      expect(result.current.conflictFiles).toEqual(["existing.txt"]);
      // progress 다이얼로그를 열지 않음
      expect(mockSetOpenDialog).not.toHaveBeenCalledWith("progress");
    });

    it("pasteMode 복사에서 충돌 시 keepBoth=true로 즉시 실행한다", async () => {
      mockCheckCopyConflicts.mockResolvedValue(["existing.txt"]);
      props.isPasteMode = true;
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleCopyMove(false);
      });
      expect(mockSubmitJob).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "copy", keepBoth: true })
      );
    });
  });

  describe("handleCopyMove — cut 클립보드 처리", () => {
    it("pasteMode에서 cut 클립보드가 있으면 복사 후 클립보드를 지운다", async () => {
      props.isPasteMode = true;
      props.clipboard = {
        operation: "cut" as const,
        paths: ["/source/a.txt"],
        sourcePanel: "left" as const,
      };
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleCopyMove(false);
      });
      expect(mockClearClipboard).toHaveBeenCalled();
    });

    it("pasteMode에서 copy 클립보드는 클립보드를 지우지 않는다", async () => {
      props.isPasteMode = true;
      props.clipboard = {
        operation: "copy" as const,
        paths: ["/source/a.txt"],
        sourcePanel: "left" as const,
      };
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleCopyMove(false);
      });
      expect(mockClearClipboard).not.toHaveBeenCalled();
    });
  });

  describe("handleOverwriteAll", () => {
    it("conflictAction이 없으면 operationError를 설정한다", async () => {
      mockResolveConflictAction.mockReturnValue(null);
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleOverwriteAll();
      });
      expect(result.current.operationError).toBeTruthy();
      expect(mockSubmitJob).not.toHaveBeenCalled();
    });

    it("conflictAction이 있으면 overwrite=true로 job을 제출한다", async () => {
      mockResolveConflictAction.mockReturnValue({
        isMove: false,
        sourcePaths: ["/source/a.txt"],
        targetPath: "/target",
      });
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleOverwriteAll();
      });
      expect(mockSubmitJob).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "copy", overwrite: true })
      );
    });
  });

  describe("handleSkipExisting", () => {
    it("conflictAction이 없으면 operationError를 설정한다", async () => {
      mockResolveConflictAction.mockReturnValue(null);
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleSkipExisting();
      });
      expect(result.current.operationError).toBeTruthy();
    });

    it("비충돌 파일이 있으면 해당 파일만 복사한다", async () => {
      mockResolveConflictAction.mockReturnValue({
        isMove: false,
        sourcePaths: ["/source/a.txt", "/source/b.txt"],
        targetPath: "/target",
      });
      mockFilterNonConflictingSourcePaths.mockReturnValue(["/source/b.txt"]);
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleSkipExisting();
      });
      expect(mockSubmitJob).toHaveBeenCalledWith(
        expect.objectContaining({ sourcePaths: ["/source/b.txt"] })
      );
    });

    it("비충돌 파일이 없으면 closeDialog를 호출한다", async () => {
      mockResolveConflictAction.mockReturnValue({
        isMove: false,
        sourcePaths: ["/source/a.txt"],
        targetPath: "/target",
      });
      mockFilterNonConflictingSourcePaths.mockReturnValue([]);
      const { result } = renderHook(() => useCopyMoveFlow(props));
      await act(async () => {
        await result.current.handleSkipExisting();
      });
      expect(mockSubmitJob).not.toHaveBeenCalled();
      expect(mockCloseDialog).toHaveBeenCalled();
    });
  });

  describe("openDialog 변경 시 상태 초기화", () => {
    it("openDialog가 변경되면 operationError와 conflictFiles가 초기화된다", async () => {
      mockCheckCopyConflicts.mockResolvedValue(["existing.txt"]);
      const { result, rerender } = renderHook(
        (p: ReturnType<typeof defaultProps>) => useCopyMoveFlow(p),
        { initialProps: props }
      );
      await act(async () => {
        await result.current.handleCopyMove(false);
      });
      expect(result.current.conflictFiles).toHaveLength(1);

      // openDialog 변경으로 상태 초기화
      act(() => {
        rerender({ ...props, openDialog: "mkdir" });
      });
      expect(result.current.conflictFiles).toHaveLength(0);
    });
  });
});
