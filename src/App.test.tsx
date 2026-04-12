import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { usePanelStore } from './store/panelStore';
import App from './App';

const mockSyncOtherPanelToCurrentPath = vi.fn();
const listenHandlers = new Map<string, () => void>();

// ── Tauri IPC / event mocks ───────────────────────────────────────────────────
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockImplementation(async (eventName: string, handler: () => void) => {
    listenHandlers.set(eventName, handler);
    return () => {
      listenHandlers.delete(eventName);
    };
  }),
}));

// ── 전역 키보드 훅 (복잡한 의존성 제거) ─────────────────────────────────────────
vi.mock('./hooks/useKeyboard', () => ({ useKeyboard: () => {} }));
vi.mock('./hooks/useAppCommands', () => ({
  useAppCommands: () => ({
    syncOtherPanelToCurrentPath: mockSyncOtherPanelToCurrentPath,
  }),
}));

// ── 자식 컴포넌트 stub (렌더링 비용 제거) ───────────────────────────────────────
vi.mock('./components/panel/DualPanel',          () => ({ DualPanel:          () => null }));
vi.mock('./components/layout/StatusBar',         () => ({ StatusBar:          () => null }));
vi.mock('./components/dialogs/DialogContainer',  () => ({ DialogContainer:    () => null }));
vi.mock('./components/dialogs/SearchPreviewDialogs', () => ({ SearchPreviewDialogs: () => null }));
vi.mock('./components/dialogs/SyncDialog',       () => ({ SyncDialog:         () => null }));
vi.mock('./components/layout/ContextMenu',       () => ({ ContextMenu:        () => null }));

// ── 테스트 ────────────────────────────────────────────────────────────────────
describe('App — Tab 키 패널 전환', () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
    listenHandlers.clear();
    mockSyncOtherPanelToCurrentPath.mockReset();
  });

  it('초기 activePanel은 left', () => {
    render(<App />);
    expect(usePanelStore.getState().activePanel).toBe('left');
  });

  it('Tab → activePanel이 right로 전환', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(usePanelStore.getState().activePanel).toBe('right');
  });

  it('Tab → Tab → activePanel이 left로 복귀', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'Tab' });
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(usePanelStore.getState().activePanel).toBe('left');
  });

  it('right 패널 활성 상태에서 Tab → left로 전환', () => {
    usePanelStore.getState().setActivePanel('right');
    render(<App />);
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(usePanelStore.getState().activePanel).toBe('left');
  });

  it('target-equals-source-requested 이벤트 → 대상=원본 액션 호출', async () => {
    render(<App />);

    await Promise.resolve();

    const handler = listenHandlers.get('target-equals-source-requested');
    expect(handler).toBeTypeOf('function');

    handler?.();

    expect(mockSyncOtherPanelToCurrentPath).toHaveBeenCalledTimes(1);
  });
});
