import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  TEST_FILES,
  getListEl,
  makeProps,
  mockClearSelection,
  mockGetDirSize,
  mockOpenPreviewDialog,
  mockSelectOnly,
  mockSetSelection,
  registerFileListTestLifecycle,
} from './FileList.test-harness';
import { useClipboardStore } from '../../store/clipboardStore';
import { FileList } from './FileList';

describe('FileList', () => {
  registerFileListTestLifecycle();

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

    it('cut 클립보드에 포함된 항목은 흐리게 렌더링한다', () => {
      useClipboardStore.setState({
        clipboard: {
          paths: ['/home/user/notes.txt'],
          operation: 'cut',
          sourcePanel: 'left',
        },
      });

      render(<FileList {...makeProps()} />);

      const wrapper = document.querySelector(
        '[data-entry-path="/home/user/notes.txt"]'
      ) as HTMLElement;
      expect(wrapper.firstElementChild).toHaveClass('opacity-40');
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

    it('항목 클릭 → 해당 항목만 선택한다', () => {
      render(<FileList {...makeProps({ cursorIndex: 0 })} />);
      const wrapper = document.querySelector('[data-entry-path="/home/user/Documents"]') as HTMLElement;

      fireEvent.click(wrapper.firstElementChild as HTMLElement);

      expect(mockSelectOnly).toHaveBeenCalledWith('left', '/home/user/Documents');
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it('Cmd/Ctrl 클릭 → 기존 선택에 항목을 토글한다', () => {
      const onSelect = vi.fn();
      render(<FileList {...makeProps({ cursorIndex: 0, onSelect })} />);
      const wrapper = document.querySelector('[data-entry-path="/home/user/Documents"]') as HTMLElement;

      fireEvent.click(wrapper.firstElementChild as HTMLElement, { ctrlKey: true });

      expect(onSelect).toHaveBeenCalledWith('/home/user/Documents', true);
      expect(mockSelectOnly).not.toHaveBeenCalled();
    });

    it('Shift 클릭 → 앵커에서 클릭한 항목까지 범위 선택한다', () => {
      render(<FileList {...makeProps({ cursorIndex: 1 })} />);
      const wrapper = document.querySelector('[data-entry-path="/home/user/notes.txt"]') as HTMLElement;

      fireEvent.click(wrapper.firstElementChild as HTMLElement, { shiftKey: true });

      expect(mockSetSelection).toHaveBeenCalledWith('left', [
        '/home/user/Documents',
        '/home/user/Downloads',
        '/home/user/notes.txt',
      ]);
    });

    it('항목 더블클릭 → onEnter 호출', () => {
      const onEnter = vi.fn();
      render(<FileList {...makeProps({ onEnter })} />);
      const wrapper = document.querySelector('[data-entry-path="/home/user/notes.txt"]') as HTMLElement;
      fireEvent.dblClick(wrapper.firstElementChild as HTMLElement);
      expect(onEnter).toHaveBeenCalledWith(TEST_FILES[3]);
    });
  });
});
