import { beforeEach, vi } from 'vitest';
import { useDialogStore } from '../../store/dialogStore';
import { usePanelStore } from '../../store/panelStore';
import type { SearchEvent, SearchResult } from '../../hooks/useFileSystem';

const searchPreviewMocks = vi.hoisted(() => ({
  mockSearchFiles: vi.fn(),
  mockCheckCopyConflicts: vi.fn(),
  mockCopyFiles: vi.fn(),
  mockMoveFiles: vi.fn(),
  mockDeleteFiles: vi.fn(),
  mockRefreshPanelsForDirectories: vi.fn(),
  mockRefreshPanelsForEntryPaths: vi.fn(),
}));

export const mockSearchFiles = searchPreviewMocks.mockSearchFiles;
export const mockCheckCopyConflicts = searchPreviewMocks.mockCheckCopyConflicts;
export const mockCopyFiles = searchPreviewMocks.mockCopyFiles;
export const mockMoveFiles = searchPreviewMocks.mockMoveFiles;
export const mockDeleteFiles = searchPreviewMocks.mockDeleteFiles;
export const mockRefreshPanelsForDirectories = searchPreviewMocks.mockRefreshPanelsForDirectories;
export const mockRefreshPanelsForEntryPaths = searchPreviewMocks.mockRefreshPanelsForEntryPaths;

vi.mock('re-resizable', () => ({
  Resizable: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    searchFiles: searchPreviewMocks.mockSearchFiles,
    checkCopyConflicts: searchPreviewMocks.mockCheckCopyConflicts,
    copyFiles: searchPreviewMocks.mockCopyFiles,
    moveFiles: searchPreviewMocks.mockMoveFiles,
    deleteFiles: searchPreviewMocks.mockDeleteFiles,
  }),
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : fallback,
}));

vi.mock('../../store/panelRefresh', () => ({
  refreshPanelsForDirectories: searchPreviewMocks.mockRefreshPanelsForDirectories,
  refreshPanelsForEntryPaths: searchPreviewMocks.mockRefreshPanelsForEntryPaths,
}));

export const emitSearchEvents = (
  onEvent: (event: SearchEvent) => void,
  results: SearchResult[] = []
) => {
  if (results.length > 0) {
    onEvent({ type: 'ResultBatch', payload: results });
  }
  onEvent({ type: 'Finished', payload: { total_matches: results.length } });
};

export const registerSearchPreviewDialogsTestLifecycle = () => {
  beforeEach(() => {
    useDialogStore.setState(useDialogStore.getInitialState());
    usePanelStore.setState(usePanelStore.getInitialState());
    useDialogStore.getState().setOpenDialog('search');
    usePanelStore.setState((state) => ({
      ...state,
      activePanel: 'left',
      leftPanel: {
        ...state.leftPanel,
        currentPath: '/home/user',
        resolvedPath: '/home/user',
      },
      rightPanel: {
        ...state.rightPanel,
        currentPath: '/target',
        resolvedPath: '/target',
      },
    }));
    searchPreviewMocks.mockSearchFiles.mockReset();
    searchPreviewMocks.mockCheckCopyConflicts.mockReset();
    searchPreviewMocks.mockCopyFiles.mockReset();
    searchPreviewMocks.mockMoveFiles.mockReset();
    searchPreviewMocks.mockDeleteFiles.mockReset();
    searchPreviewMocks.mockRefreshPanelsForDirectories.mockReset();
    searchPreviewMocks.mockRefreshPanelsForEntryPaths.mockReset();
    searchPreviewMocks.mockSearchFiles.mockImplementation(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        emitSearchEvents(onEvent);
      }
    );
    searchPreviewMocks.mockCheckCopyConflicts.mockResolvedValue([]);
  });
};

export type { SearchEvent };
