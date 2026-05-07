import { act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import type { FileEntry } from '../../types/file';
import { useClipboardStore } from '../../store/clipboardStore';
import { useDragStore } from '../../store/dragStore';
import {
  resetSharedDragState,
  sharedPanelPaths,
} from './fileListDragSharedState';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: (path: string) => `asset://${path}`,
}));

const fileListMocks = vi.hoisted(() => ({
  mockSubmitJob: vi.fn(),
  mockCheckCopyConflicts: vi.fn(),
  mockGetDirSize: vi.fn(),
  mockListDirectory: vi.fn(),
  mockSetSelection: vi.fn(),
  mockSelectOnly: vi.fn(),
  mockClearSelection: vi.fn(),
  mockRefreshPanel: vi.fn(),
  mockSetActivePanel: vi.fn(),
  mockOpenDragCopyDialog: vi.fn(),
  mockOpenPreviewDialog: vi.fn(),
  mockShowTransientToast: vi.fn(),
  mockPanelState: {
    leftPanel: {
      currentPath: '/home/user',
      resolvedPath: '/home/user',
      lastUpdated: 0,
      tabs: [{ id: 'tab1', sortField: 'name', sortDirection: 'asc', lastUpdated: 0 }],
      activeTabId: 'tab1',
    },
    rightPanel: {
      currentPath: '/target',
      resolvedPath: '/target',
      lastUpdated: 0,
      tabs: [{ id: 'tab2', sortField: 'name', sortDirection: 'asc', lastUpdated: 0 }],
      activeTabId: 'tab2',
    },
  },
}));

export const mockSubmitJob = fileListMocks.mockSubmitJob;
export const mockCheckCopyConflicts = fileListMocks.mockCheckCopyConflicts;
export const mockGetDirSize = fileListMocks.mockGetDirSize;
export const mockListDirectory = fileListMocks.mockListDirectory;
export const mockSetSelection = fileListMocks.mockSetSelection;
export const mockSelectOnly = fileListMocks.mockSelectOnly;
export const mockClearSelection = fileListMocks.mockClearSelection;
export const mockRefreshPanel = fileListMocks.mockRefreshPanel;
export const mockSetActivePanel = fileListMocks.mockSetActivePanel;
export const mockOpenDragCopyDialog = fileListMocks.mockOpenDragCopyDialog;
export const mockOpenPreviewDialog = fileListMocks.mockOpenPreviewDialog;
export const mockShowTransientToast = fileListMocks.mockShowTransientToast;
export const mockPanelState = fileListMocks.mockPanelState;

vi.mock('../../hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    checkCopyConflicts: fileListMocks.mockCheckCopyConflicts,
    copyFiles: vi.fn().mockResolvedValue([]),
    submitJob: fileListMocks.mockSubmitJob,
    getDirSize: fileListMocks.mockGetDirSize,
    listDirectory: fileListMocks.mockListDirectory,
  }),
}));

vi.mock('../../store/dialogStore', () => ({
  useDialogStore: Object.assign((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      openDragCopyDialog: fileListMocks.mockOpenDragCopyDialog,
      openPreviewDialog: fileListMocks.mockOpenPreviewDialog,
    }), {
    getState: () => ({}),
  }),
}));

vi.mock('../../store/toastStore', () => ({
  showTransientToast: fileListMocks.mockShowTransientToast,
}));

vi.mock('../../store/panelStore', () => ({
  usePanelStore: Object.assign((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      updateEntrySize: vi.fn(),
      setSelection: fileListMocks.mockSetSelection,
      selectOnly: fileListMocks.mockSelectOnly,
      clearSelection: fileListMocks.mockClearSelection,
      refreshPanel: fileListMocks.mockRefreshPanel,
      setActivePanel: fileListMocks.mockSetActivePanel,
      showHiddenFiles: false,
      sizeCache: {},
      leftPanel: fileListMocks.mockPanelState.leftPanel,
      rightPanel: fileListMocks.mockPanelState.rightPanel,
    }), {
    getState: () => ({
      leftPanel: fileListMocks.mockPanelState.leftPanel,
      rightPanel: fileListMocks.mockPanelState.rightPanel,
      refreshPanel: fileListMocks.mockRefreshPanel,
      setActivePanel: fileListMocks.mockSetActivePanel,
    }),
  }),
  sortEntries: (entries: unknown[]) => entries,
}));

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

export const TEST_FILES: FileEntry[] = [
  { name: '..', path: '/home', kind: 'directory' },
  { name: 'Documents', path: '/home/user/Documents', kind: 'directory', size: null },
  { name: 'Downloads', path: '/home/user/Downloads', kind: 'directory', size: null },
  { name: 'notes.txt', path: '/home/user/notes.txt', kind: 'file', size: 1024 },
  { name: 'photo.png', path: '/home/user/photo.png', kind: 'file', size: 2048 },
];

export const makeProps = (overrides: Partial<React.ComponentProps<typeof import('./FileList').FileList>> = {}) => ({
  currentPath: '/home/user',
  accessPath: '/home/user',
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

export const getListEl = () => document.querySelector('[tabindex="0"]') as HTMLElement;

export const setContainerRect = () => {
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

export const mockElementFromPoint = (element: HTMLElement) => {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => element),
  });
};

const resetSharedDragGlobals = () => {
  resetSharedDragState();
  sharedPanelPaths.left = { accessPath: '', currentPath: '' };
  sharedPanelPaths.right = { accessPath: '', currentPath: '' };
};

export const performInternalDrag = async (
  sourceRow: HTMLElement,
  targetRow: HTMLElement,
  startPoint = { x: 20, y: 20 },
  movePoint = { x: 40, y: 40 }
) => {
  mockElementFromPoint(targetRow);
  fireEvent.mouseDown(sourceRow, {
    button: 0,
    clientX: startPoint.x,
    clientY: startPoint.y,
  });

  await act(async () => {
    document.dispatchEvent(
      new MouseEvent('mousemove', { clientX: movePoint.x, clientY: movePoint.y })
    );
    document.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: movePoint.x + 2,
        clientY: movePoint.y + 2,
      })
    );
  });
};

export const registerFileListTestLifecycle = () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPanelState.leftPanel.currentPath = '/home/user';
    mockPanelState.leftPanel.resolvedPath = '/home/user';
    mockPanelState.leftPanel.lastUpdated = 0;
    mockPanelState.leftPanel.tabs = [
      { id: 'tab1', sortField: 'name', sortDirection: 'asc', lastUpdated: 0 },
    ];
    mockPanelState.leftPanel.activeTabId = 'tab1';
    mockPanelState.rightPanel.currentPath = '/target';
    mockPanelState.rightPanel.resolvedPath = '/target';
    mockPanelState.rightPanel.lastUpdated = 0;
    mockPanelState.rightPanel.tabs = [
      { id: 'tab2', sortField: 'name', sortDirection: 'asc', lastUpdated: 0 },
    ];
    mockPanelState.rightPanel.activeTabId = 'tab2';
    useClipboardStore.setState({ clipboard: null });
    useDragStore.setState({ dragInfo: null });
    resetSharedDragGlobals();
    mockSubmitJob.mockResolvedValue({
      id: 'job-1',
      kind: 'copy',
      status: 'queued',
      createdAt: 1,
      updatedAt: 1,
      progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
      error: null,
      result: null,
    });
    mockCheckCopyConflicts.mockResolvedValue([]);
    mockGetDirSize.mockResolvedValue(0);
    mockListDirectory.mockResolvedValue([]);
    mockSetSelection.mockReset();
    mockSelectOnly.mockReset();
    mockClearSelection.mockReset();
  });

  afterEach(() => {
    if ('elementFromPoint' in document) {
      Reflect.deleteProperty(document as unknown as Record<string, unknown>, 'elementFromPoint');
    }
    useClipboardStore.setState({ clipboard: null });
    useDragStore.setState({ dragInfo: null });
    resetSharedDragGlobals();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
};

export { useClipboardStore };
