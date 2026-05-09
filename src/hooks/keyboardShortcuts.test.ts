import { vi, describe, it, expect, beforeEach } from 'vitest';
import { calculatePanelDirectories, createKeyboardHandler } from './keyboardShortcuts';
import type { KeyboardHandlerDependencies } from './keyboardShortcuts';
import type { PanelState } from '../types/file';

// ── hoisted mocks ────────────────────────────────────────────────────────────
const mockPanelStoreGetState = vi.hoisted(() => vi.fn());
const mockClipboardStoreGetState = vi.hoisted(() => vi.fn());
const mockDialogStoreGetState = vi.hoisted(() => vi.fn());

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
  openInfoDialog: vi.fn(),
  pasteFromClipboard: vi.fn(),
  swapPanels: vi.fn(),
  syncOtherPanelToCurrentPath: vi.fn(),
  setPanelViewMode: vi.fn(),
  goBack: vi.fn(),
  goForward: vi.fn(),
  getDirSize: vi.fn().mockResolvedValue(0),
  updateEntrySize: vi.fn(),
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
  it('calls getDirSize for each directory entry (excluding "..")', async () => {
    const getDirSize = vi.fn().mockResolvedValue(100);
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: 'docs', path: '/home/docs', kind: 'directory' },
      { name: 'images', path: '/home/images', kind: 'directory' },
    ]);

    await calculatePanelDirectories({ panelId: 'left', panel, getDirSize, updateEntrySize });

    expect(getDirSize).toHaveBeenCalledTimes(2);
    expect(getDirSize).toHaveBeenCalledWith('/home/docs');
    expect(getDirSize).toHaveBeenCalledWith('/home/images');
  });

  it('calls updateEntrySize with resolved size', async () => {
    const getDirSize = vi.fn().mockResolvedValue(512);
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: 'docs', path: '/home/docs', kind: 'directory' },
    ]);

    await calculatePanelDirectories({ panelId: 'left', panel, getDirSize, updateEntrySize });

    expect(updateEntrySize).toHaveBeenCalledWith('left', '/home/docs', 512);
  });

  it('skips non-directory entries (kind === "file")', async () => {
    const getDirSize = vi.fn().mockResolvedValue(0);
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: 'readme.txt', path: '/home/readme.txt', kind: 'file' },
      { name: 'script.sh', path: '/home/script.sh', kind: 'file' },
    ]);

    await calculatePanelDirectories({ panelId: 'left', panel, getDirSize, updateEntrySize });

    expect(getDirSize).not.toHaveBeenCalled();
    expect(updateEntrySize).not.toHaveBeenCalled();
  });

  it('skips ".." entries (kind === "directory", name === "..")', async () => {
    const getDirSize = vi.fn().mockResolvedValue(0);
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: '..', path: '/home', kind: 'directory' },
    ]);

    await calculatePanelDirectories({ panelId: 'left', panel, getDirSize, updateEntrySize });

    expect(getDirSize).not.toHaveBeenCalled();
    expect(updateEntrySize).not.toHaveBeenCalled();
  });

  it('catches error from getDirSize without rethrowing — updateEntrySize not called for that entry', async () => {
    const getDirSize = vi.fn().mockRejectedValue(new Error('permission denied'));
    const updateEntrySize = vi.fn();
    const panel = makePanel([
      { name: 'secret', path: '/home/secret', kind: 'directory' },
    ]);

    await expect(
      calculatePanelDirectories({ panelId: 'left', panel, getDirSize, updateEntrySize })
    ).resolves.toBeUndefined();

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
