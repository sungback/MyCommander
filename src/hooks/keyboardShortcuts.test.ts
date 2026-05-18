import { vi, describe, it, expect, beforeEach } from 'vitest';
import { calculatePanelDirectories } from './calculatePanelDirectories';
import { createKeyboardHandler } from './keyboardShortcuts';
import type { KeyboardHandlerDependencies } from './keyboardShortcuts';
import type { PanelState } from '../types/file';

// ── hoisted mocks ────────────────────────────────────────────────────────────
const mockPanelStoreGetState = vi.hoisted(() => vi.fn());
const mockClipboardStoreGetState = vi.hoisted(() => vi.fn());
const mockDialogStoreGetState = vi.hoisted(() => vi.fn());
const mockListen = vi.hoisted(() =>
  vi.fn().mockResolvedValue(() => undefined)
);

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

vi.mock('../store/panelStore', () => ({
  usePanelStore: { getState: mockPanelStoreGetState },
}));
vi.mock('../store/clipboardStore', () => ({
  useClipboardStore: { getState: mockClipboardStoreGetState },
}));
vi.mock('../store/dialogStore', () => ({
  useDialogStore: { getState: mockDialogStoreGetState },
}));
vi.mock('./useAppCommands', async () => ({
  showTransientStatusMessage: vi.fn(),
  isMacPlatform: vi.fn().mockReturnValue(false),
}));
vi.mock('../store/favoriteStore', () => ({
  useFavoriteStore: { getState: vi.fn().mockReturnValue({}) },
}));

// ── helpers ──────────────────────────────────────────────────────────────────
const makeEvent = (key: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
  vi.spyOn(e, 'preventDefault');
  return e;
};

const makeDeps = (overrides: Partial<KeyboardHandlerDependencies> = {}): KeyboardHandlerDependencies => ({
  isMac: false,
  closeApp: vi.fn().mockResolvedValue(undefined),
  copyCurrentPath: vi.fn(),
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  cutToClipboard: vi.fn().mockResolvedValue(undefined),
  openCopy: vi.fn(),
  openDelete: vi.fn(),
  openDialog: null,
  openEditor: vi.fn().mockResolvedValue(undefined),
  openMkdir: vi.fn(),
  openMove: vi.fn(),
  openNewFile: vi.fn(),
  openPreview: vi.fn(),
  openSearch: vi.fn(),
  openSync: vi.fn(),
  openCommandPalette: vi.fn(),
  openInfoDialog: vi.fn(),
  pasteFromClipboard: vi.fn(),
  swapPanels: vi.fn(),
  syncOtherPanelToCurrentPath: vi.fn(),
  cancelDirSizeScan: vi.fn().mockResolvedValue(undefined),
  setEntrySizeStatus: vi.fn(),
  setPanelViewMode: vi.fn(),
  goBack: vi.fn(),
  goForward: vi.fn(),
  scanDirSize: vi.fn().mockResolvedValue({
    size: 0,
    isPartial: false,
    scannedEntries: 0,
    errorCount: 0,
  }),
  updateEntrySize: vi.fn(),
  updateEntrySizeEstimate: vi.fn(),
  updateEntrySizeProgress: vi.fn(),
  ...overrides,
});

const makePanel = (files: PanelState['files'] = []): PanelState => ({
  id: 'left',
  tabs: [],
  activeTabId: '',
  currentPath: '/home',
  files,
  cursorIndex: 0,
  selectedItems: new Set<string>(),
  history: ['/home'],
  historyIndex: 0,
  sortField: 'name',
  sortDirection: 'asc',
  lastUpdated: 0,
  pendingCursorName: null,
});

// ── beforeEach ───────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockPanelStoreGetState.mockReturnValue({
    activePanel: 'left',
    leftPanel: makePanel(),
    rightPanel: makePanel(),
  });
  mockClipboardStoreGetState.mockReturnValue({ clipboard: null, clearClipboard: vi.fn() });
  mockDialogStoreGetState.mockReturnValue({ closeDialog: vi.fn() });
});

// ── calculatePanelDirectories ─────────────────────────────────────────────────
describe('calculatePanelDirectories', () => {
  it('calls scanDirSize for each directory entry (excluding "..")', async () => {
    const scanDirSize = vi.fn().mockResolvedValue({
      size: 100,
      isPartial: false,
      scannedEntries: 1,
      errorCount: 0,
    });
    const cancelDirSizeScan = vi.fn().mockResolvedValue(undefined);
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: 'docs', path: '/home/docs', kind: 'directory' },
      { name: 'images', path: '/home/images', kind: 'directory' },
    ]);

    await calculatePanelDirectories({
      cancelDirSizeScan,
      panelId: 'left',
      panel,
      scanDirSize,
      updateEntrySize,
    });

    expect(scanDirSize).toHaveBeenCalledTimes(2);
    expect(scanDirSize).toHaveBeenCalledWith('/home/docs', expect.any(String));
    expect(scanDirSize).toHaveBeenCalledWith('/home/images', expect.any(String));
  });

  it('calls updateEntrySize with resolved size', async () => {
    const scanDirSize = vi.fn().mockResolvedValue({
      size: 512,
      isPartial: false,
      scannedEntries: 1,
      errorCount: 0,
    });
    const cancelDirSizeScan = vi.fn().mockResolvedValue(undefined);
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: 'docs', path: '/home/docs', kind: 'directory' },
    ]);

    await calculatePanelDirectories({
      cancelDirSizeScan,
      panelId: 'left',
      panel,
      scanDirSize,
      updateEntrySize,
    });

    expect(updateEntrySize).toHaveBeenCalledWith('left', '/home/docs', 512);
  });

  it('marks directory entries as calculating before exact size work', async () => {
    const scanDirSize = vi.fn().mockResolvedValue({
      size: 512,
      isPartial: false,
      scannedEntries: 1,
      errorCount: 0,
    });
    const cancelDirSizeScan = vi.fn().mockResolvedValue(undefined);
    const setEntrySizeStatus = vi.fn();
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: 'docs', path: '/home/docs', kind: 'directory' },
    ]);

    await calculatePanelDirectories({
      cancelDirSizeScan,
      panelId: 'left',
      panel,
      scanDirSize,
      setEntrySizeStatus,
      updateEntrySize,
    });

    expect(setEntrySizeStatus).toHaveBeenCalledWith(
      'left',
      '/home/docs',
      'calculating'
    );
  });

  it('skips non-directory entries (kind === "file")', async () => {
    const cancelDirSizeScan = vi.fn().mockResolvedValue(undefined);
    const scanDirSize = vi.fn().mockResolvedValue({
      size: 0,
      isPartial: false,
      scannedEntries: 0,
      errorCount: 0,
    });
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: 'readme.txt', path: '/home/readme.txt', kind: 'file' },
      { name: 'script.sh', path: '/home/script.sh', kind: 'file' },
    ]);

    await calculatePanelDirectories({
      cancelDirSizeScan,
      panelId: 'left',
      panel,
      scanDirSize,
      updateEntrySize,
    });

    expect(scanDirSize).not.toHaveBeenCalled();
    expect(updateEntrySize).not.toHaveBeenCalled();
  });

  it('skips ".." entries (kind === "directory", name === "..")', async () => {
    const cancelDirSizeScan = vi.fn().mockResolvedValue(undefined);
    const scanDirSize = vi.fn().mockResolvedValue({
      size: 0,
      isPartial: false,
      scannedEntries: 0,
      errorCount: 0,
    });
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: '..', path: '/home', kind: 'directory' },
    ]);

    await calculatePanelDirectories({
      cancelDirSizeScan,
      panelId: 'left',
      panel,
      scanDirSize,
      updateEntrySize,
    });

    expect(scanDirSize).not.toHaveBeenCalled();
    expect(updateEntrySize).not.toHaveBeenCalled();
  });

  it('catches error from getDirSize without rethrowing — updateEntrySize not called for that entry', async () => {
    const cancelDirSizeScan = vi.fn().mockResolvedValue(undefined);
    const scanDirSize = vi.fn().mockRejectedValue(new Error('permission denied'));
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: 'secret', path: '/home/secret', kind: 'directory' },
    ]);

    await expect(
      calculatePanelDirectories({
        cancelDirSizeScan,
        panelId: 'left',
        panel,
        scanDirSize,
        updateEntrySize,
      })
    ).resolves.toEqual({ total: 1, completed: 0, failed: 1 });

    expect(updateEntrySize).not.toHaveBeenCalled();
  });
});

// ── createKeyboardHandler ─────────────────────────────────────────────────────
describe('createKeyboardHandler', () => {
  it('Mac Cmd+Q → calls deps.closeApp()', () => {
    const deps = makeDeps({ isMac: true });
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('q', { metaKey: true, code: 'KeyQ' }));
    expect(deps.closeApp).toHaveBeenCalledTimes(1);
  });

  it('non-Mac Alt+F4 → calls deps.closeApp()', () => {
    const deps = makeDeps({ isMac: false });
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('F4', { altKey: true }));
    expect(deps.closeApp).toHaveBeenCalledTimes(1);
  });

  it('F3 → calls deps.openPreview()', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('F3'));
    expect(deps.openPreview).toHaveBeenCalledTimes(1);
  });

  it('F5 → calls deps.openCopy()', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('F5'));
    expect(deps.openCopy).toHaveBeenCalledTimes(1);
  });

  it('F6 → calls deps.openMove()', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('F6'));
    expect(deps.openMove).toHaveBeenCalledTimes(1);
  });

  it('F7 → calls deps.openMkdir()', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('F7'));
    expect(deps.openMkdir).toHaveBeenCalledTimes(1);
  });

  it('F8 (not input focused) → calls deps.openDelete()', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    // jsdom default activeElement is document.body (tagName BODY), not INPUT
    handler(makeEvent('F8'));
    expect(deps.openDelete).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+F → calls deps.openSearch()', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('f', { ctrlKey: true, code: 'KeyF' }));
    expect(deps.openSearch).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+P → calls deps.openCommandPalette()', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('p', { ctrlKey: true, shiftKey: true, code: 'KeyP' }));
    expect(deps.openCommandPalette).toHaveBeenCalledTimes(1);
  });

  it('Mac Cmd+Shift+P → calls deps.openCommandPalette()', () => {
    const deps = makeDeps({ isMac: true });
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('p', { metaKey: true, shiftKey: true, code: 'KeyP' }));
    expect(deps.openCommandPalette).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+C → calls deps.copyToClipboard()', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('c', { ctrlKey: true, code: 'KeyC' }));
    expect(deps.copyToClipboard).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+V → calls deps.pasteFromClipboard()', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('v', { ctrlKey: true, code: 'KeyV' }));
    expect(deps.pasteFromClipboard).toHaveBeenCalledTimes(1);
  });

  it('Alt+ArrowLeft → calls deps.goBack with active panel id', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('ArrowLeft', { altKey: true }));
    expect(deps.goBack).toHaveBeenCalledWith('left');
  });

  it('Alt+ArrowRight → calls deps.goForward with active panel id', () => {
    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('ArrowRight', { altKey: true }));
    expect(deps.goForward).toHaveBeenCalledWith('left');
  });

  it('Escape with clipboard set → calls clearClipboard', () => {
    const mockClearClipboard = vi.fn();
    mockClipboardStoreGetState.mockReturnValue({
      clipboard: { paths: ['/a'], operation: 'copy', sourcePanel: 'left' },
      clearClipboard: mockClearClipboard,
    });

    const deps = makeDeps();
    const handler = createKeyboardHandler(deps);
    handler(makeEvent('Escape'));

    expect(mockClearClipboard).toHaveBeenCalledTimes(1);
  });
});
