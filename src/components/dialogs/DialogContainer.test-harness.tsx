import { beforeEach, vi } from 'vitest';
import { useClipboardStore } from '../../store/clipboardStore';
import { useDialogStore } from '../../store/dialogStore';
import { usePanelStore } from '../../store/panelStore';

const dialogContainerMocks = vi.hoisted(() => ({
  mockCreateDirectory: vi.fn(),
  mockCreateFile: vi.fn(),
  mockRenameFile: vi.fn(),
  mockGetDirSize: vi.fn(),
  mockSubmitJob: vi.fn(),
  mockCheckCopyConflicts: vi.fn(),
  mockShowTransientStatusMessage: vi.fn(),
  mockRefreshPanelsForDirectories: vi.fn(),
}));

export const mockCreateDirectory = dialogContainerMocks.mockCreateDirectory;
export const mockCreateFile = dialogContainerMocks.mockCreateFile;
export const mockRenameFile = dialogContainerMocks.mockRenameFile;
export const mockGetDirSize = dialogContainerMocks.mockGetDirSize;
export const mockSubmitJob = dialogContainerMocks.mockSubmitJob;
export const mockCheckCopyConflicts = dialogContainerMocks.mockCheckCopyConflicts;
export const mockShowTransientStatusMessage = dialogContainerMocks.mockShowTransientStatusMessage;
export const mockRefreshPanelsForDirectories = dialogContainerMocks.mockRefreshPanelsForDirectories;

vi.mock('../../hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    createDirectory: dialogContainerMocks.mockCreateDirectory,
    createFile: dialogContainerMocks.mockCreateFile,
    renameFile: dialogContainerMocks.mockRenameFile,
    submitJob: dialogContainerMocks.mockSubmitJob,
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    checkCopyConflicts: dialogContainerMocks.mockCheckCopyConflicts,
    getDirSize: dialogContainerMocks.mockGetDirSize,
  }),
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : fallback,
}));

vi.mock('../../store/panelRefresh', () => ({
  refreshPanelsForDirectories: dialogContainerMocks.mockRefreshPanelsForDirectories,
}));

vi.mock('./QuickPreviewDialog', () => ({
  QuickPreviewDialog: () => null,
}));

vi.mock('./SettingsDialog', () => ({
  SettingsDialog: () => null,
}));

vi.mock('../../hooks/useAppCommands', () => ({
  showTransientStatusMessage: dialogContainerMocks.mockShowTransientStatusMessage,
}));

const setSelectedDeleteState = () => {
  usePanelStore.setState((state) => ({
    ...state,
    activePanel: 'left',
    leftPanel: {
      ...state.leftPanel,
      currentPath: '/home/user',
      resolvedPath: '/home/user',
      files: [
        { name: '..', path: '/home', kind: 'directory' },
        { name: 'LargeFolder', path: '/home/user/LargeFolder', kind: 'directory', size: null },
      ],
      selectedItems: new Set<string>(['/home/user/LargeFolder']),
      cursorIndex: 1,
      tabs: state.leftPanel.tabs.map((tab) =>
        tab.id === state.leftPanel.activeTabId
          ? {
              ...tab,
              currentPath: '/home/user',
              resolvedPath: '/home/user',
              files: [
                { name: '..', path: '/home', kind: 'directory' },
                {
                  name: 'LargeFolder',
                  path: '/home/user/LargeFolder',
                  kind: 'directory',
                  size: null,
                },
              ],
              selectedItems: new Set<string>(['/home/user/LargeFolder']),
              cursorIndex: 1,
            }
          : tab
      ),
    },
  }));
};

export const registerDialogContainerTestLifecycle = () => {
  beforeEach(() => {
    useDialogStore.setState(useDialogStore.getInitialState());
    usePanelStore.setState(usePanelStore.getInitialState());
    useClipboardStore.setState({ clipboard: null });
    setSelectedDeleteState();
    useDialogStore.getState().setOpenDialog('delete');
    dialogContainerMocks.mockCreateDirectory.mockReset();
    dialogContainerMocks.mockCreateFile.mockReset();
    dialogContainerMocks.mockRenameFile.mockReset();
    dialogContainerMocks.mockGetDirSize.mockReset();
    dialogContainerMocks.mockSubmitJob.mockReset();
    dialogContainerMocks.mockCheckCopyConflicts.mockReset();
    dialogContainerMocks.mockShowTransientStatusMessage.mockReset();
    dialogContainerMocks.mockRefreshPanelsForDirectories.mockReset();
    dialogContainerMocks.mockGetDirSize.mockResolvedValue(0);
    dialogContainerMocks.mockCheckCopyConflicts.mockResolvedValue([]);
  });
};
