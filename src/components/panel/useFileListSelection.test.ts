import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFileListSelection } from "./useFileListSelection";
import type { VisibleEntryRow } from "./fileListRows";

const makeRow = (name: string, kind: "file" | "directory" = "file"): VisibleEntryRow => ({
  entry: {
    name,
    path: `/home/${name}`,
    kind,
    size: kind === "file" ? 100 : null,
    lastModified: null,
    isHidden: false,
  },
  depth: 0,
  isExpanded: false,
  canExpand: kind === "directory",
});

const makeParentRow = (): VisibleEntryRow => ({
  entry: {
    name: "..",
    path: "/home",
    kind: "directory",
    size: null,
    lastModified: null,
    isHidden: false,
  },
  depth: 0,
  isExpanded: false,
  canExpand: false,
});

const makeMouseEvent = (overrides: Partial<MouseEvent> = {}): MouseEvent =>
  ({
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...overrides,
  } as unknown as MouseEvent);

const rows = [makeParentRow(), makeRow("a.txt"), makeRow("b.txt"), makeRow("c.txt")];

const defaultProps = () => ({
  clearSelection: vi.fn(),
  currentPath: "/home",
  cursorIndex: 0,
  focusContainer: vi.fn(),
  onSelect: vi.fn(),
  panelId: "left" as const,
  selectedItems: new Set<string>(),
  selectOnly: vi.fn(),
  setCursorIndex: vi.fn(),
  setSelection: vi.fn(),
  showHiddenFiles: false,
  visibleRows: rows,
});

describe("useFileListSelection", () => {
  let props: ReturnType<typeof defaultProps>;

  beforeEach(() => {
    props = defaultProps();
  });

  describe("moveSelectionToRow", () => {
    it("유효한 인덱스로 커서와 단일 선택을 설정한다", () => {
      const { result } = renderHook(() => useFileListSelection(props));
      act(() => result.current.moveSelectionToRow(2));
      expect(props.setCursorIndex).toHaveBeenCalledWith(2);
      expect(props.selectOnly).toHaveBeenCalledWith("left", "/home/b.txt");
    });

    it("음수 인덱스는 0으로 클램프된다", () => {
      props.cursorIndex = 1;
      const { result } = renderHook(() => useFileListSelection(props));
      act(() => result.current.moveSelectionToRow(-1));
      expect(props.setCursorIndex).toHaveBeenCalledWith(0);
    });

    it("범위 초과 인덱스는 마지막으로 클램프된다", () => {
      const { result } = renderHook(() => useFileListSelection(props));
      act(() => result.current.moveSelectionToRow(100));
      expect(props.setCursorIndex).toHaveBeenCalledWith(rows.length - 1);
    });

    it("'..' 항목이면 clearSelection을 호출한다", () => {
      const { result } = renderHook(() => useFileListSelection(props));
      act(() => result.current.moveSelectionToRow(0));
      expect(props.clearSelection).toHaveBeenCalledWith("left");
      expect(props.selectOnly).not.toHaveBeenCalled();
    });

    it("visibleRows가 비어있으면 아무것도 하지 않는다", () => {
      props.visibleRows = [];
      const { result } = renderHook(() => useFileListSelection(props));
      act(() => result.current.moveSelectionToRow(0));
      expect(props.setCursorIndex).not.toHaveBeenCalled();
    });
  });

  describe("extendSelectionToRow", () => {
    it("앵커에서 타깃까지 범위 선택을 설정한다", () => {
      props.cursorIndex = 1;
      const { result } = renderHook(() => useFileListSelection(props));
      // 먼저 앵커를 설정하기 위해 moveSelectionToRow 호출
      act(() => result.current.moveSelectionToRow(1));
      vi.clearAllMocks();
      act(() => result.current.extendSelectionToRow(3));
      // rows[1]=a.txt, rows[2]=b.txt, rows[3]=c.txt (rows[0]=".."은 비선택)
      expect(props.setSelection).toHaveBeenCalledWith("left", [
        "/home/a.txt",
        "/home/b.txt",
        "/home/c.txt",
      ]);
    });

    it("앵커 없이는 cursorIndex를 앵커로 사용한다", () => {
      props.cursorIndex = 1;
      const { result } = renderHook(() => useFileListSelection(props));
      act(() => result.current.extendSelectionToRow(3));
      expect(props.setSelection).toHaveBeenCalledWith("left", [
        "/home/a.txt",
        "/home/b.txt",
        "/home/c.txt",
      ]);
    });

    it("역방향(위쪽)으로도 범위 선택이 동작한다", () => {
      props.cursorIndex = 3;
      const { result } = renderHook(() => useFileListSelection(props));
      act(() => result.current.extendSelectionToRow(1));
      expect(props.setSelection).toHaveBeenCalledWith("left", [
        "/home/a.txt",
        "/home/b.txt",
        "/home/c.txt",
      ]);
    });
  });

  describe("handleRowClick", () => {
    it("일반 클릭은 커서를 이동하고 단일 선택한다", () => {
      const { result } = renderHook(() => useFileListSelection(props));
      act(() =>
        result.current.handleRowClick(
          makeMouseEvent() as unknown as React.MouseEvent<HTMLDivElement>,
          2,
          rows[2].entry
        )
      );
      expect(props.setCursorIndex).toHaveBeenCalledWith(2);
      expect(props.selectOnly).toHaveBeenCalledWith("left", "/home/b.txt");
      expect(props.focusContainer).toHaveBeenCalled();
    });

    it("'..' 항목 클릭은 clearSelection을 호출한다", () => {
      const { result } = renderHook(() => useFileListSelection(props));
      act(() =>
        result.current.handleRowClick(
          makeMouseEvent() as unknown as React.MouseEvent<HTMLDivElement>,
          0,
          rows[0].entry
        )
      );
      expect(props.clearSelection).toHaveBeenCalledWith("left");
      expect(props.selectOnly).not.toHaveBeenCalled();
    });

    it("Ctrl+클릭은 toggle 선택한다", () => {
      const { result } = renderHook(() => useFileListSelection(props));
      act(() =>
        result.current.handleRowClick(
          makeMouseEvent({ ctrlKey: true }) as unknown as React.MouseEvent<HTMLDivElement>,
          1,
          rows[1].entry
        )
      );
      expect(props.onSelect).toHaveBeenCalledWith("/home/a.txt", true);
    });

    it("Shift+클릭은 앵커에서 클릭 행까지 범위를 선택한다", () => {
      props.cursorIndex = 1;
      const { result } = renderHook(() => useFileListSelection(props));
      // 앵커 설정
      act(() =>
        result.current.handleRowClick(
          makeMouseEvent() as unknown as React.MouseEvent<HTMLDivElement>,
          1,
          rows[1].entry
        )
      );
      vi.clearAllMocks();
      // Shift+클릭으로 범위 확장
      act(() =>
        result.current.handleRowClick(
          makeMouseEvent({ shiftKey: true }) as unknown as React.MouseEvent<HTMLDivElement>,
          3,
          rows[3].entry
        )
      );
      expect(props.setSelection).toHaveBeenCalledWith("left", [
        "/home/a.txt",
        "/home/b.txt",
        "/home/c.txt",
      ]);
    });

    it("Shift+Ctrl+클릭은 기존 선택과 새 범위를 병합한다", () => {
      props.selectedItems = new Set(["/home/c.txt"]);
      props.cursorIndex = 1;
      const { result } = renderHook(() => useFileListSelection(props));
      act(() =>
        result.current.handleRowClick(
          makeMouseEvent() as unknown as React.MouseEvent<HTMLDivElement>,
          1,
          rows[1].entry
        )
      );
      vi.clearAllMocks();
      act(() =>
        result.current.handleRowClick(
          makeMouseEvent({ shiftKey: true, ctrlKey: true }) as unknown as React.MouseEvent<HTMLDivElement>,
          2,
          rows[2].entry
        )
      );
      const calledPaths = props.setSelection.mock.calls[0][1] as string[];
      expect(calledPaths).toContain("/home/a.txt");
      expect(calledPaths).toContain("/home/b.txt");
      expect(calledPaths).toContain("/home/c.txt");
    });
  });

  describe("resetSelectionAnchor", () => {
    it("앵커를 초기화한 뒤 extendSelectionToRow는 cursorIndex를 앵커로 사용한다", () => {
      props.cursorIndex = 2;
      const { result } = renderHook(() => useFileListSelection(props));
      act(() => result.current.moveSelectionToRow(3));
      act(() => result.current.resetSelectionAnchor());
      vi.clearAllMocks();
      // 앵커가 초기화됐으므로 cursorIndex(2)가 앵커로 사용됨
      act(() => result.current.extendSelectionToRow(3));
      expect(props.setSelection).toHaveBeenCalledWith("left", [
        "/home/b.txt",
        "/home/c.txt",
      ]);
    });
  });
});
