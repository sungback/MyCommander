import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useKeyboard } from './useKeyboard';

// ── hoisted mocks ────────────────────────────────────────────────────────────
const {
  mockOpenPreview, mockOpenEditor, mockOpenCopy, mockOpenMove,
  mockOpenMkdir, mockOpenNewFile, mockOpenDelete, mockOpenSearch,
  mockCloseApp, mockSyncOtherPanel, mockCopyCurrentPath,
  mockOpenInfoDialog, mockCloseDialog,
  mockUpdateEntrySize, mockSetPanelViewMode,
  mockGetDirSize, mockIsMacPlatform,
} = vi.hoisted(() => ({
  mockOpenPreview:     vi.fn(),
  mockOpenEditor:      vi.fn().mockResolvedValue(undefined),
  mockOpenCopy:        vi.fn(),
  mockOpenMove:        vi.fn(),
  mockOpenMkdir:       vi.fn(),
  mockOpenNewFile:     vi.fn(),
  mockOpenDelete:      vi.fn(),
  mockOpenSearch:      vi.fn(),
  mockCloseApp:        vi.fn().mockResolvedValue(undefined),
  mockSyncOtherPanel:  vi.fn(),
  mockCopyCurrentPath: vi.fn().mockResolvedValue(undefined),
  mockOpenInfoDialog:  vi.fn(),
  mockCloseDialog:     vi.fn(),
  mockUpdateEntrySize: vi.fn(),
  mockSetPanelViewMode: vi.fn(),
  mockGetDirSize:      vi.fn().mockResolvedValue(0),
  mockIsMacPlatform:   vi.fn().mockReturnValue(false),
}));

// openDialog 값을 테스트에서 동적으로 변경할 수 있도록 모듈 스코프 변수 사용
let mockOpenDialogValue: string | null = null;

vi.mock('./useAppCommands', () => ({
  isMacPlatform: () => mockIsMacPlatform(),
  useAppCommands: () => ({
    openDialog:                 mockOpenDialogValue,
    openPreview:                mockOpenPreview,
    openEditor:                 mockOpenEditor,
    openCopy:                   mockOpenCopy,
    openMove:                   mockOpenMove,
    openMkdir:                  mockOpenMkdir,
    openNewFile:                mockOpenNewFile,
    openDelete:                 mockOpenDelete,
    openSearch:                 mockOpenSearch,
    closeApp:                   mockCloseApp,
    syncOtherPanelToCurrentPath: mockSyncOtherPanel,
    copyCurrentPath:            mockCopyCurrentPath,
  }),
}));

vi.mock('./useFileSystem', () => ({
  useFileSystem: () => ({ getDirSize: mockGetDirSize }),
}));

vi.mock('../store/panelStore', () => ({
  usePanelStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ updateEntrySize: mockUpdateEntrySize, setPanelViewMode: mockSetPanelViewMode }),
    {
      getState: () => ({
        activePanel: 'left',
        leftPanel:  { files: [], cursorIndex: 0 },
        rightPanel: { files: [], cursorIndex: 0 },
      }),
    }
  ),
}));

vi.mock('../store/dialogStore', () => ({
  useDialogStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        openInfoDialog: mockOpenInfoDialog,
        openDialog:     mockOpenDialogValue,
        closeDialog:    mockCloseDialog,
      }),
    {
      getState: () => ({ openDialog: mockOpenDialogValue, closeDialog: mockCloseDialog }),
    }
  ),
}));

// ── helpers ──────────────────────────────────────────────────────────────────
const press = (key: string, extra: KeyboardEventInit = {}) =>
  fireEvent.keyDown(window, { key, ...extra });

const renderKeyboard = () => renderHook(() => useKeyboard());

// ── tests ────────────────────────────────────────────────────────────────────
describe('useKeyboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenDialogValue = null;
    mockIsMacPlatform.mockReturnValue(false);
  });

  // ── F키 단축키 ───────────────────────────────────────────────────────────────
  describe('F키 단축키', () => {
    it('F3 → openPreview 호출', () => {
      renderKeyboard();
      press('F3');
      expect(mockOpenPreview).toHaveBeenCalledTimes(1);
    });

    it('F4 → openEditor 호출', () => {
      renderKeyboard();
      press('F4');
      expect(mockOpenEditor).toHaveBeenCalledTimes(1);
    });

    it('Shift+F4 → openNewFile 호출', () => {
      renderKeyboard();
      press('F4', { shiftKey: true });
      expect(mockOpenNewFile).toHaveBeenCalledTimes(1);
      expect(mockOpenEditor).not.toHaveBeenCalled();
    });

    it('F5 → openCopy 호출', () => {
      renderKeyboard();
      press('F5');
      expect(mockOpenCopy).toHaveBeenCalledTimes(1);
    });

    it('F6 → openMove 호출', () => {
      renderKeyboard();
      press('F6');
      expect(mockOpenMove).toHaveBeenCalledTimes(1);
    });

    it('F7 → openMkdir 호출', () => {
      renderKeyboard();
      press('F7');
      expect(mockOpenMkdir).toHaveBeenCalledTimes(1);
    });

    it('Alt+F7 → openSearch 호출', () => {
      renderKeyboard();
      press('F7', { altKey: true });
      expect(mockOpenSearch).toHaveBeenCalledTimes(1);
      expect(mockOpenMkdir).not.toHaveBeenCalled();
    });

    it('F8 → openDelete 호출', () => {
      renderKeyboard();
      press('F8');
      expect(mockOpenDelete).toHaveBeenCalledTimes(1);
    });

    it('Delete → openDelete 호출', () => {
      renderKeyboard();
      press('Delete');
      expect(mockOpenDelete).toHaveBeenCalledTimes(1);
    });
  });

  // ── Ctrl/Cmd 단축키 ──────────────────────────────────────────────────────────
  describe('Ctrl/Cmd 단축키', () => {
    it('Ctrl+F → openSearch 호출', () => {
      renderKeyboard();
      press('f', { code: 'KeyF', ctrlKey: true });
      expect(mockOpenSearch).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+Shift+M → syncOtherPanelToCurrentPath 호출', () => {
      renderKeyboard();
      press('m', { code: 'KeyM', ctrlKey: true, shiftKey: true });
      expect(mockSyncOtherPanel).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+Shift+C → copyCurrentPath 호출', () => {
      renderKeyboard();
      press('c', { code: 'KeyC', ctrlKey: true, shiftKey: true });
      expect(mockCopyCurrentPath).toHaveBeenCalledTimes(1);
    });
  });

  // ── 앱 종료 ──────────────────────────────────────────────────────────────────
  describe('앱 종료 단축키', () => {
    it('Windows: Alt+F4 → closeApp 호출', () => {
      mockIsMacPlatform.mockReturnValue(false);
      renderKeyboard();
      press('F4', { altKey: true });
      expect(mockCloseApp).toHaveBeenCalledTimes(1);
    });

    it('Mac: Cmd+Q → closeApp 호출', () => {
      mockIsMacPlatform.mockReturnValue(true);
      renderKeyboard();
      press('q', { code: 'KeyQ', metaKey: true });
      expect(mockCloseApp).toHaveBeenCalledTimes(1);
    });

    it('Mac: Alt+F4는 closeApp 미호출 (Mac 단축키 아님)', () => {
      mockIsMacPlatform.mockReturnValue(true);
      renderKeyboard();
      press('F4', { altKey: true });
      expect(mockCloseApp).not.toHaveBeenCalled();
    });
  });

  // ── 다이얼로그 열린 상태 ──────────────────────────────────────────────────────
  describe('다이얼로그 열린 상태', () => {
    it('다이얼로그 열려 있을 때 F3 → openPreview 미호출', () => {
      mockOpenDialogValue = 'copy';
      renderKeyboard();
      press('F3');
      expect(mockOpenPreview).not.toHaveBeenCalled();
    });

    it('다이얼로그 열려 있을 때 Escape → closeDialog 호출', () => {
      mockOpenDialogValue = 'copy';
      renderKeyboard();
      press('Escape');
      expect(mockCloseDialog).toHaveBeenCalledTimes(1);
    });
  });
});
