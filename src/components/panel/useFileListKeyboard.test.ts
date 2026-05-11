import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFileListKeyboard } from "./useFileListKeyboard";
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

const makeKey = (key: string, overrides: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  ({
    key,
    code: key === " " ? "Space" : key.startsWith("Key") ? key : `Key${key.toUpperCase()}`,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent);

const defaultProps = () => ({
  currentPath: "/home",
  cursorIndex: 0,
  extendSelectionToRow: vi.fn(),
  getDirSize: vi.fn().mockResolvedValue(1024),
  isActivePanel: true,
  moveSelectionToRow: vi.fn(),
  onEnter: vi.fn(),
  onSelect: vi.fn(),
  openPreviewDialog: vi.fn(),
  panelId: "left" as const,
  setCursorIndex: vi.fn(),
  setEntrySizeStatus: vi.fn(),
  setSelection: vi.fn(),
  showHiddenFiles: false,
  updateEntrySize: vi.fn(),
  visibleRows: [makeRow("a.txt"), makeRow("b.txt"), makeRow("c.txt")],
});

describe("useFileListKeyboard", () => {
  let props: ReturnType<typeof defaultProps>;

  beforeEach(() => {
    props = defaultProps();
  });

  it("비활성 패널에서는 키 이벤트를 처리하지 않는다", () => {
    props.isActivePanel = false;
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("ArrowDown");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.moveSelectionToRow).not.toHaveBeenCalled();
  });

  it("visibleRows가 비어있으면 키 이벤트를 처리하지 않는다", () => {
    props.visibleRows = [];
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("ArrowDown");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.moveSelectionToRow).not.toHaveBeenCalled();
  });

  it("ArrowDown은 moveSelectionToRow(cursorIndex+1)을 호출한다", () => {
    props.cursorIndex = 1;
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("ArrowDown");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.moveSelectionToRow).toHaveBeenCalledWith(2);
  });

  it("Shift+ArrowDown은 extendSelectionToRow를 호출한다", () => {
    props.cursorIndex = 0;
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("ArrowDown", { shiftKey: true });
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.extendSelectionToRow).toHaveBeenCalledWith(1);
    expect(props.moveSelectionToRow).not.toHaveBeenCalled();
  });

  it("ArrowUp은 moveSelectionToRow(cursorIndex-1)을 호출한다", () => {
    props.cursorIndex = 2;
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("ArrowUp");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.moveSelectionToRow).toHaveBeenCalledWith(1);
  });

  it("Shift+ArrowUp은 extendSelectionToRow를 호출한다", () => {
    props.cursorIndex = 2;
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("ArrowUp", { shiftKey: true });
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.extendSelectionToRow).toHaveBeenCalledWith(1);
  });

  it("ArrowLeft는 moveSelectionToRow(0)을 호출한다", () => {
    props.cursorIndex = 2;
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("ArrowLeft");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.moveSelectionToRow).toHaveBeenCalledWith(0);
  });

  it("ArrowRight는 moveSelectionToRow(마지막 인덱스)를 호출한다", () => {
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("ArrowRight");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.moveSelectionToRow).toHaveBeenCalledWith(2);
  });

  it("Insert는 현재 항목을 toggle 선택하고 커서를 한 칸 내린다", () => {
    props.cursorIndex = 0;
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("Insert");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.onSelect).toHaveBeenCalledWith("/home/a.txt", true);
    expect(props.setCursorIndex).toHaveBeenCalledWith(1);
  });

  it("Insert는 마지막 항목에서 커서를 초과시키지 않는다", () => {
    props.cursorIndex = 2;
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("Insert");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.setCursorIndex).toHaveBeenCalledWith(2);
  });

  it("Enter는 현재 항목으로 onEnter를 호출한다", () => {
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("Enter");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.onEnter).toHaveBeenCalledWith(props.visibleRows[0].entry);
  });

  it("Space는 파일이면 openPreviewDialog를 호출한다", () => {
    props.visibleRows = [makeRow("a.txt", "file")];
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey(" ", { code: "Space" });
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.openPreviewDialog).toHaveBeenCalledWith({
      panelId: "left",
      path: "/home/a.txt",
    });
    expect(props.getDirSize).not.toHaveBeenCalled();
  });

  it("Space는 디렉터리면 onSelect를 호출하고 getDirSize를 시작한다", () => {
    props.visibleRows = [makeRow("docs", "directory")];
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey(" ", { code: "Space" });
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.onSelect).toHaveBeenCalledWith("/home/docs", true);
    expect(props.setEntrySizeStatus).toHaveBeenCalledWith(
      "left",
      "/home/docs",
      "calculating"
    );
    expect(props.getDirSize).toHaveBeenCalledWith("/home/docs");
  });

  it("Space는 '..' 항목에서 getDirSize를 호출하지 않는다", () => {
    props.visibleRows = [makeParentRow()];
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey(" ", { code: "Space" });
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.getDirSize).not.toHaveBeenCalled();
  });

  it("Ctrl+A는 선택 가능한 모든 항목을 setSelection으로 설정한다", () => {
    props.visibleRows = [makeParentRow(), makeRow("a.txt"), makeRow("b.txt")];
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("a", { code: "KeyA", ctrlKey: true });
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.setSelection).toHaveBeenCalledWith("left", ["/home/a.txt", "/home/b.txt"]);
  });

  it("문자 입력은 타입어헤드 검색으로 일치하는 항목으로 이동한다", () => {
    props.visibleRows = [makeRow("alpha.txt"), makeRow("beta.txt"), makeRow("gamma.txt")];
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("b");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.moveSelectionToRow).toHaveBeenCalledWith(1);
  });

  it("타입어헤드에서 일치 항목이 없으면 moveSelectionToRow를 호출하지 않는다", () => {
    props.visibleRows = [makeRow("alpha.txt"), makeRow("beta.txt")];
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("z");
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    expect(props.moveSelectionToRow).not.toHaveBeenCalled();
  });

  it("Ctrl 조합 단일 문자는 타입어헤드를 트리거하지 않는다", () => {
    const { result } = renderHook(() => useFileListKeyboard(props));
    const event = makeKey("c", { code: "KeyC", ctrlKey: true });
    result.current.handleKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    // Ctrl+C는 타입어헤드가 아니므로 moveSelectionToRow 미호출
    expect(props.moveSelectionToRow).not.toHaveBeenCalled();
  });
});
