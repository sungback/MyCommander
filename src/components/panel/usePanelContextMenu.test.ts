import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type RefObject } from 'react';
import type { FileEntry } from '../../types/file';
import { useContextMenuStore } from '../../store/contextMenuStore';
import { usePanelContextMenu } from './usePanelContextMenu';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockShowContextMenu = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../hooks/useFileSystem', () => ({
  useFileSystem: () => ({ showContextMenu: mockShowContextMenu }),
  getErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.stubGlobal('alert', vi.fn());

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeProps = (panelElement: HTMLDivElement | null = null, overrides: Record<string, unknown> = {}) => ({
  files: [] as FileEntry[],
  panelId: 'left' as const,
  panelRef: { current: panelElement } as RefObject<HTMLDivElement | null>,
  selectOnly: vi.fn(),
  selectedItems: new Set<string>(),
  setActivePanel: vi.fn(),
  setCursor: vi.fn(),
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('usePanelContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowContextMenu.mockResolvedValue(undefined);
    // Reset Zustand store to initial state
    useContextMenuStore.setState({
      isOpen: false,
      panelId: null,
      targetPath: null,
      targetEntry: null,
      x: 0,
      y: 0,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('null panelRef → no event listener, no error', () => {
    const props = makeProps(null);
    renderHook(() => usePanelContextMenu(props));

    const event = new MouseEvent('contextmenu', { bubbles: true });
    document.body.dispatchEvent(event);

    expect(props.setActivePanel).not.toHaveBeenCalled();
  });

  it('right-click on panel background (no entry element) → setActivePanel + openContextMenu with null targetPath', () => {
    const panelDiv = document.createElement('div');
    document.body.appendChild(panelDiv);
    const props = makeProps(panelDiv);

    renderHook(() => usePanelContextMenu(props));

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 20,
    });
    act(() => {
      panelDiv.dispatchEvent(event);
    });

    expect(props.setActivePanel).toHaveBeenCalledWith('left');
    expect(props.setCursor).not.toHaveBeenCalled();
    expect(props.selectOnly).not.toHaveBeenCalled();

    const state = useContextMenuStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.targetPath).toBeNull();
  });

  it('right-click on a file entry element → calls setCursor + selectOnly + openContextMenu', () => {
    const panelDiv = document.createElement('div');
    document.body.appendChild(panelDiv);

    const entryEl = document.createElement('div');
    entryEl.dataset.entryPath = '/home/user/file.txt';
    entryEl.dataset.entryIndex = '2';
    entryEl.dataset.entryName = 'file.txt';
    entryEl.dataset.entryKind = 'file';
    panelDiv.appendChild(entryEl);

    const files: FileEntry[] = [
      { name: 'file.txt', path: '/home/user/file.txt', kind: 'file', size: 100, lastModified: null } as FileEntry,
    ];
    const props = makeProps(panelDiv, { files, selectedItems: new Set<string>() });

    renderHook(() => usePanelContextMenu(props));

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => {
      entryEl.dispatchEvent(event);
    });

    expect(props.setCursor).toHaveBeenCalledWith('left', 2);
    expect(props.selectOnly).toHaveBeenCalledWith('left', '/home/user/file.txt');
  });

  it('right-click when entry already selected → selectOnly NOT called', () => {
    const panelDiv = document.createElement('div');
    document.body.appendChild(panelDiv);

    const entryEl = document.createElement('div');
    entryEl.dataset.entryPath = '/home/user/file.txt';
    entryEl.dataset.entryIndex = '2';
    entryEl.dataset.entryName = 'file.txt';
    entryEl.dataset.entryKind = 'file';
    panelDiv.appendChild(entryEl);

    const props = makeProps(panelDiv, {
      selectedItems: new Set(['/home/user/file.txt']),
    });

    renderHook(() => usePanelContextMenu(props));

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => {
      entryEl.dispatchEvent(event);
    });

    expect(props.selectOnly).not.toHaveBeenCalled();
    // setCursor still called because entry path exists
    expect(props.setCursor).toHaveBeenCalledWith('left', 2);
  });

  it('background right-click → fs.showContextMenu called with hasTargetItem: false', () => {
    const panelDiv = document.createElement('div');
    document.body.appendChild(panelDiv);
    const props = makeProps(panelDiv, { selectedItems: new Set(['/a', '/b']) });

    renderHook(() => usePanelContextMenu(props));

    act(() => {
      panelDiv.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
    });

    expect(mockShowContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ hasTargetItem: false }),
    );
  });

  it('fs.showContextMenu rejection → window.alert called', async () => {
    mockShowContextMenu.mockRejectedValueOnce(new Error('menu failed'));

    const panelDiv = document.createElement('div');
    document.body.appendChild(panelDiv);
    const props = makeProps(panelDiv);

    renderHook(() => usePanelContextMenu(props));

    await act(async () => {
      panelDiv.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.alert).toHaveBeenCalled();
  });

  it('cleanup: removes event listener on unmount', () => {
    const panelDiv = document.createElement('div');
    document.body.appendChild(panelDiv);
    const props = makeProps(panelDiv);

    const { unmount } = renderHook(() => usePanelContextMenu(props));
    unmount();

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => {
      panelDiv.dispatchEvent(event);
    });

    expect(props.setActivePanel).not.toHaveBeenCalled();
  });
});
