import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { FileList } from './FileList';
import type { FileEntry } from '../../types/file';

// ── Tauri IPC mock ──────────────────────────────────────────────────────────
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// ── useFileSystem mock (vi.hoisted로 호이스팅 — 팩토리 실행 전에 변수 준비) ──
const {
  mockCopyFiles,
  mockGetDirSize,
  mockListDirectory,
  mockSetSelection,
  mockSelectOnly,
  mockClearSelection,
  mockRefreshPanel,
  mockSetActivePanel,
  mockSetDragInfo,
  mockOpenPreviewDialog,
  mockPanelState,
} = vi.hoisted(() => ({
  mockCopyFiles: vi.fn(),
  mockGetDirSize: vi.fn(),
  mockListDirectory: vi.fn(),
  mockSetSelection: vi.fn(),
  mockSelectOnly: vi.fn(),
  mockClearSelection: vi.fn(),
  mockRefreshPanel: vi.fn(),
  mockSetActivePanel: vi.fn(),
  mockSetDragInfo: vi.fn(),
  mockOpenPreviewDialog: vi.fn(),
  mockPanelState: {
    dragInfo: null as
      | {
          paths: string[];
          directoryPaths: string[];
          sourcePanel: 'left' | 'right';
        }
      | null,
  },
}));

vi.mock('../../hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    copyFiles: mockCopyFiles,
    getDirSize: mockGetDirSize,
    listDirectory: mockListDirectory,
  }),
}));

vi.mock('../../store/dialogStore', () => ({
  useDialogStore: Object.assign((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setOpenDialog: vi.fn(),
      openPreviewDialog: mockOpenPreviewDialog,
    }), {
      getState: () => ({}),
    }),
}));

vi.mock('../../store/panelStore', () => ({
  usePanelStore: Object.assign((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      updateEntrySize: vi.fn(),
      setSelection: mockSetSelection,
      selectOnly: mockSelectOnly,
      clearSelection: mockClearSelection,
      refreshPanel: mockRefreshPanel,
      setActivePanel: mockSetActivePanel,
      showHiddenFiles: false,
      sizeCache: {},
      dragInfo: mockPanelState.dragInfo,
      setDragInfo: mockSetDragInfo,
    }), {
      getState: () => ({
        dragInfo: mockPanelState.dragInfo,
        setActivePanel: mockSetActivePanel,
      }),
    }),
}));

// ── react-virtual mock (예측 가능한 렌더링) ──────────────────────────────────
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number }) => ({
    getTotalSize: () => opts.count * opts.estimateSize(),
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        index: i,
        size: opts.estimateSize(),
        start: i * opts.estimateSize(),
      })),
    scrollToIndex: vi.fn(),
  }),
}));

// ── 테스트 데이터 ─────────────────────────────────────────────────────────────
const TEST_FILES: FileEntry[] = [
  { name: '..', path: '/home', kind: 'directory' },
  { name: 'Documents', path: '/home/user/Documents', kind: 'directory', size: null },
  { name: 'Downloads', path: '/home/user/Downloads', kind: 'directory', size: null },
  { name: 'notes.txt', path: '/home/user/notes.txt', kind: 'file', size: 1024 },
  { name: 'photo.png', path: '/home/user/photo.png', kind: 'file', size: 2048 },
];

const makeProps = (overrides: Partial<React.ComponentProps<typeof FileList>> = {}) => ({
  currentPath: '/home/user',
  files: TEST_FILES,
  selectedItems: new Set<string>(),
  cursorIndex: 0,
  isActivePanel: true,
  panelId: 'left' as const,
  viewMode: 'detailed' as const,
  onSelect: vi.fn(),
  onEnter: vi.fn(),
  setCursorIndex: vi.fn(),
  ...overrides,
});

const getListEl = () => document.querySelector('[tabindex="0"]') as HTMLElement;

// ── 테스트 ────────────────────────────────────────────────────────────────────
describe('FileList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPanelState.dragInfo = null;
    mockSetDragInfo.mockImplementation((dragInfo) => {
      mockPanelState.dragInfo = dragInfo;
    });
    mockCopyFiles.mockResolvedValue(undefined);
    mockGetDirSize.mockResolvedValue(0);
    mockListDirectory.mockResolvedValue([]);
    mockSetSelection.mockReset();
    mockSelectOnly.mockReset();
    mockClearSelection.mockReset();
  });

  // ── 렌더링 ──────────────────────────────────────────────────────────────────
  describe('렌더링', () => {
    it('파일 목록의 모든 항목을 렌더링한다', () => {
      render(<FileList {...makeProps()} />);
      expect(document.querySelector('[data-entry-path="/home"]')).toBeInTheDocument();
      expect(document.querySelector('[data-entry-path="/home/user/Documents"]')).toBeInTheDocument();
      expect(document.querySelector('[data-entry-path="/home/user/notes.txt"]')).toBeInTheDocument();
    });

    it('빈 파일 목록일 때 항목을 렌더링하지 않는다', () => {
      render(<FileList {...makeProps({ files: [] })} />);
      expect(document.querySelectorAll('[data-entry-path]')).toHaveLength(0);
    });

    it('각 항목에 data-entry-path 속성이 설정된다', () => {
      render(<FileList {...makeProps()} />);
      expect(document.querySelectorAll('[data-entry-path]')).toHaveLength(TEST_FILES.length);
    });
  });

  // ── 키보드: 이동 ─────────────────────────────────────────────────────────────
  describe('키보드 네비게이션', () => {
    it('ArrowDown → setCursorIndex(cursorIndex + 1) 호출', () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'ArrowDown' });
      expect(setCursorIndex).toHaveBeenCalledWith(1);
    });

    it('ArrowUp at top → setCursorIndex(0) (하한 0 유지)', () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'ArrowUp' });
      expect(setCursorIndex).toHaveBeenCalledWith(0);
    });

    it('ArrowDown at bottom → setCursorIndex(마지막 인덱스) (상한 유지)', () => {
      const setCursorIndex = vi.fn();
      const lastIndex = TEST_FILES.length - 1;
      render(<FileList {...makeProps({ cursorIndex: lastIndex, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'ArrowDown' });
      expect(setCursorIndex).toHaveBeenCalledWith(lastIndex);
    });

    it('ArrowLeft → setCursorIndex(0) (목록 맨 위로)', () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 3, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'ArrowLeft' });
      expect(setCursorIndex).toHaveBeenCalledWith(0);
    });

    it('ArrowRight → setCursorIndex(마지막 인덱스) (목록 맨 아래로)', () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'ArrowRight' });
      expect(setCursorIndex).toHaveBeenCalledWith(TEST_FILES.length - 1);
    });

    it('Shift+ArrowDown → 앵커에서 다음 행까지 범위 선택', () => {
      render(<FileList {...makeProps({ cursorIndex: 2 })} />); // Downloads
      fireEvent.keyDown(getListEl(), { key: 'ArrowDown', shiftKey: true });
      expect(mockSetSelection).toHaveBeenCalledWith('left', [
        '/home/user/Downloads',
        '/home/user/notes.txt',
      ]);
    });

    it('Shift+ArrowUp → 앵커에서 이전 행까지 범위 선택', () => {
      render(<FileList {...makeProps({ cursorIndex: 3 })} />); // notes.txt
      fireEvent.keyDown(getListEl(), { key: 'ArrowUp', shiftKey: true });
      expect(mockSetSelection).toHaveBeenCalledWith('left', [
        '/home/user/Downloads',
        '/home/user/notes.txt',
      ]);
    });

    it('Shift+ArrowDown at bottom → 범위 유지 (상한 클램핑)', () => {
      const lastIndex = TEST_FILES.length - 1;
      render(<FileList {...makeProps({ cursorIndex: lastIndex })} />); // photo.png
      fireEvent.keyDown(getListEl(), { key: 'ArrowDown', shiftKey: true });
      expect(mockSetSelection).toHaveBeenCalledWith('left', ['/home/user/photo.png']);
    });

    it('Shift+ArrowDown ".." 행 포함 범위 → ".." 경로 제외', () => {
      render(<FileList {...makeProps({ cursorIndex: 0 })} />); // ..
      fireEvent.keyDown(getListEl(), { key: 'ArrowDown', shiftKey: true });
      // ".."은 isSelectableEntry에서 제외됨
      expect(mockSetSelection).toHaveBeenCalledWith('left', ['/home/user/Documents']);
    });

    it('비활성 패널에서는 키보드 이벤트를 무시한다', () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ isActivePanel: false, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'ArrowDown' });
      expect(setCursorIndex).not.toHaveBeenCalled();
    });

    it('Ctrl+A → ".." 제외한 모든 항목 경로로 setSelection 호출', () => {
      render(<FileList {...makeProps()} />);
      fireEvent.keyDown(getListEl(), { key: 'a', code: 'KeyA', ctrlKey: true });
      expect(mockSetSelection).toHaveBeenCalledWith('left', [
        '/home/user/Documents',
        '/home/user/Downloads',
        '/home/user/notes.txt',
        '/home/user/photo.png',
      ]);
    });

    it('Meta+A(macOS) → ".." 제외한 모든 항목 경로로 setSelection 호출', () => {
      render(<FileList {...makeProps()} />);
      fireEvent.keyDown(getListEl(), { key: 'a', code: 'KeyA', metaKey: true });
      expect(mockSetSelection).toHaveBeenCalledWith('left', [
        '/home/user/Documents',
        '/home/user/Downloads',
        '/home/user/notes.txt',
        '/home/user/photo.png',
      ]);
    });

    it('비활성 패널에서 Ctrl+A → setSelection 미호출', () => {
      render(<FileList {...makeProps({ isActivePanel: false })} />);
      fireEvent.keyDown(getListEl(), { key: 'a', code: 'KeyA', ctrlKey: true });
      expect(mockSetSelection).not.toHaveBeenCalled();
    });
  });

  // ── 키보드: Enter / Space ────────────────────────────────────────────────────
  // 컴포넌트는 e.code === "Space"로 체크하므로 code: 'Space' 사용
  describe('Enter / Space', () => {
    it('Enter → 현재 커서 항목에 대해 onEnter 호출', () => {
      const onEnter = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 1, onEnter })} />);
      fireEvent.keyDown(getListEl(), { key: 'Enter' });
      expect(onEnter).toHaveBeenCalledWith(TEST_FILES[1]);
    });

    it('Insert → onSelect 호출 후 커서를 다음 행으로 이동', () => {
      const onSelect = vi.fn();
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 1, onSelect, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'Insert' });
      expect(onSelect).toHaveBeenCalledWith('/home/user/Documents', true);
      expect(setCursorIndex).toHaveBeenCalledWith(2);
    });

    it('Space → 파일에 대해 미리보기 다이얼로그를 연다', () => {
      render(<FileList {...makeProps({ cursorIndex: 3 })} />); // notes.txt (file)
      fireEvent.keyDown(getListEl(), { key: ' ', code: 'Space' });
      expect(mockOpenPreviewDialog).toHaveBeenCalledWith({
        panelId: 'left',
        path: '/home/user/notes.txt',
      });
      expect(mockGetDirSize).not.toHaveBeenCalled();
    });

    it('Space → 디렉토리에 대해 getDirSize 호출', () => {
      render(<FileList {...makeProps({ cursorIndex: 1 })} />); // Documents (dir)
      fireEvent.keyDown(getListEl(), { key: ' ', code: 'Space' });
      expect(mockGetDirSize).toHaveBeenCalledWith('/home/user/Documents');
    });

    it('Space → getDirSize 에러 시 조용히 실패한다', async () => {
      mockGetDirSize.mockRejectedValueOnce(new Error('disk error'));
      render(<FileList {...makeProps({ cursorIndex: 1 })} />);
      await act(async () => {
        fireEvent.keyDown(getListEl(), { key: ' ', code: 'Space' });
      });
      // 에러가 throw되지 않고 console.error로 처리됨
      expect(mockGetDirSize).toHaveBeenCalledWith('/home/user/Documents');
    });
  });

  // ── 증분 검색 (type-ahead) ────────────────────────────────────────────────────
  describe('증분 검색', () => {
    it("'n' 입력 → notes.txt 커서 이동", () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'n' });
      expect(setCursorIndex).toHaveBeenCalledWith(3); // notes.txt
    });

    it("'d' 입력 → Documents로 커서 이동 (첫 번째 매치)", () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'd' });
      expect(setCursorIndex).toHaveBeenCalledWith(1); // Documents
    });

    it("'d' → 'o' → 'w' 순차 입력 → Downloads로 커서 이동", () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'd' });
      fireEvent.keyDown(getListEl(), { key: 'o' });
      fireEvent.keyDown(getListEl(), { key: 'w' });
      // 마지막 호출이 Downloads(index 2)여야 함
      expect(setCursorIndex).toHaveBeenLastCalledWith(2);
    });

    it("일치하는 파일 없음 → setCursorIndex 미호출", () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'z' });
      expect(setCursorIndex).not.toHaveBeenCalled();
    });

    it("대소문자 무시 — 'N' 입력 → notes.txt 커서 이동", () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'N' });
      expect(setCursorIndex).toHaveBeenCalledWith(3);
    });

    it("비활성 패널 → 타이핑 무시", () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ isActivePanel: false, setCursorIndex })} />);
      fireEvent.keyDown(getListEl(), { key: 'n' });
      expect(setCursorIndex).not.toHaveBeenCalled();
    });
  });

  // ── 마우스 클릭 ──────────────────────────────────────────────────────────────
  describe('마우스 클릭', () => {
    it('항목 클릭 → setCursorIndex 호출', () => {
      const setCursorIndex = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
      // onClick은 wrapper가 아닌 내부 FileItem 요소에 등록됨
      const wrapper = document.querySelector('[data-entry-path="/home/user/Documents"]') as HTMLElement;
      fireEvent.click(wrapper.firstElementChild as HTMLElement);
      expect(setCursorIndex).toHaveBeenCalledWith(1);
    });

    it('항목 더블클릭 → onEnter 호출', () => {
      const onEnter = vi.fn();
      render(<FileList {...makeProps({ onEnter })} />);
      const wrapper = document.querySelector('[data-entry-path="/home/user/notes.txt"]') as HTMLElement;
      fireEvent.dblClick(wrapper.firstElementChild as HTMLElement);
      expect(onEnter).toHaveBeenCalledWith(TEST_FILES[3]);
    });
  });

  // ── 트리 펼치기 / 접기 ───────────────────────────────────────────────────────
  describe('트리 펼치기 / 접기', () => {
    const CHILD_FILES: FileEntry[] = [
      { name: 'Work', path: '/home/user/Documents/Work', kind: 'directory' },
      { name: 'report.pdf', path: '/home/user/Documents/report.pdf', kind: 'file', size: 512 },
    ];

    // Documents 항목 안의 expand 버튼을 찾는 헬퍼
    // (..  항목에도 같은 aria-label이 있어 querySelector가 .. 버튼을 먼저 반환하므로 명시적으로 지정)
    const getDocExpandBtn = () =>
      document
        .querySelector('[data-entry-path="/home/user/Documents"]')
        ?.querySelector('[aria-label="Expand folder preview"]') as HTMLElement;

    const getDocCollapseBtn = () =>
      document
        .querySelector('[data-entry-path="/home/user/Documents"]')
        ?.querySelector('[aria-label="Collapse folder preview"]') as HTMLElement;

    it('expand 버튼 클릭 → listDirectory 호출', async () => {
      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      render(<FileList {...makeProps()} />);

      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });

      expect(mockListDirectory).toHaveBeenCalledWith('/home/user/Documents', false);
    });

    it('expand 후 자식 항목이 렌더링된다', async () => {
      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      render(<FileList {...makeProps()} />);

      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });

      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).toBeInTheDocument();
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/report.pdf"]')
      ).toBeInTheDocument();
    });

    it('expand 후 collapse 버튼 클릭 → 자식 항목 숨김', async () => {
      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      render(<FileList {...makeProps()} />);

      // 펼치기
      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).toBeInTheDocument();

      // 접기
      fireEvent.click(getDocCollapseBtn());

      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).not.toBeInTheDocument();
    });

    it('두 번째 expand 클릭 시 listDirectory를 다시 호출하지 않는다 (캐시)', async () => {
      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      render(<FileList {...makeProps()} />);

      // 펼치기
      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).toBeInTheDocument();

      // 접기
      fireEvent.click(getDocCollapseBtn());

      // 다시 펼치기
      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });

      // listDirectory는 최초 1회만 호출됨
      expect(mockListDirectory).toHaveBeenCalledTimes(1);
    });
  });

  describe('같은 패널 드래그 복사', () => {
    const setContainerRect = () => {
      const list = getListEl();
      Object.defineProperty(list, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 400,
          bottom: 400,
          width: 400,
          height: 400,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
    };

    it('같은 패널에서 폴더 위에 드롭하면 즉시 복사한다', async () => {
      render(
        <FileList
          {...makeProps({
            selectedItems: new Set<string>(['/home/user/notes.txt']),
          })}
        />
      );

      setContainerRect();

      const sourceRow = document.querySelector(
        '[data-entry-path="/home/user/notes.txt"]'
      ) as HTMLElement;
      const targetRow = document.querySelector(
        '[data-entry-path="/home/user/Documents"]'
      ) as HTMLElement;

      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: vi.fn(() => targetRow),
      });

      fireEvent.mouseDown(sourceRow, { button: 0, clientX: 20, clientY: 20 });

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 40 }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 42, clientY: 42 }));
      });

      expect(targetRow.textContent).toContain('복사');

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 40 }));
      });

      expect(mockCopyFiles).toHaveBeenCalledWith(['/home/user/notes.txt'], '/home/user/Documents');
      expect(mockRefreshPanel).toHaveBeenCalledWith('left');
    });

    it('자기 자신 하위 폴더로의 드롭은 차단한다', async () => {
      const nestedFiles: FileEntry[] = [
        { name: '..', path: '/home/user', kind: 'directory' },
        { name: 'Project', path: '/home/user/Project', kind: 'directory', size: null },
        {
          name: 'Project Child',
          path: '/home/user/Project/Child',
          kind: 'directory',
          size: null,
        },
      ];

      render(
        <FileList
          {...makeProps({
            files: nestedFiles,
            selectedItems: new Set<string>(['/home/user/Project']),
          })}
        />
      );

      setContainerRect();

      const sourceRow = document.querySelector(
        '[data-entry-path="/home/user/Project"]'
      ) as HTMLElement;
      const targetRow = document.querySelector(
        '[data-entry-path="/home/user/Project/Child"]'
      ) as HTMLElement;

      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: vi.fn(() => targetRow),
      });

      fireEvent.mouseDown(sourceRow, { button: 0, clientX: 20, clientY: 20 });

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 44, clientY: 44 }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 46, clientY: 46 }));
      });

      expect(targetRow.textContent).toContain('불가');

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 44, clientY: 44 }));
      });

      expect(mockCopyFiles).not.toHaveBeenCalled();
      expect(mockRefreshPanel).not.toHaveBeenCalled();
    });
  });
});
