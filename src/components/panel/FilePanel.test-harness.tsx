import { beforeEach, vi } from 'vitest';
import { usePanelStore } from '../../store/panelStore';
import type { FileEntry } from '../../types/file';

export const mockListDirectory = vi.fn();
export const mockGetHomeDir = vi.fn();
export const mockResolvePath = vi.fn();
export const mockGetDirSize = vi.fn();
export const mockOpenFile = vi.fn();
export const mockShowContextMenu = vi.fn();
export const mockOpenContextMenu = vi.fn();
export let lastFileListProps: {
  files: FileEntry[];
  onEnter: (entry: FileEntry) => Promise<void> | void;
} | null = null;
let mockExtraFileListRows: FileEntry[] = [];

const mockFileSystem = {
  listDirectory: mockListDirectory,
  getHomeDir: mockGetHomeDir,
  resolvePath: mockResolvePath,
  getDirSize: mockGetDirSize,
  openFile: mockOpenFile,
  showContextMenu: mockShowContextMenu,
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../hooks/useFileSystem', () => ({
  useFileSystem: () => mockFileSystem,
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : fallback,
}));

vi.mock('../../store/contextMenuStore', () => ({
  useContextMenuStore: (selector: (state: { openContextMenu: typeof mockOpenContextMenu }) => unknown) =>
    selector({ openContextMenu: mockOpenContextMenu }),
}));

vi.mock('./AddressBar', () => ({
  AddressBar: () => <div data-testid="address-bar" />,
}));

vi.mock('./ColumnHeader', () => ({
  ColumnHeader: () => <div data-testid="column-header" />,
}));

vi.mock('./DriveList', () => ({
  DriveList: () => <div data-testid="drive-list" />,
}));

vi.mock('./TabBar', () => ({
  TabBar: () => <div data-testid="tab-bar" />,
}));

vi.mock('./FileList', () => ({
  FileList: (props: {
    files: FileEntry[];
    onEnter: (entry: FileEntry) => Promise<void> | void;
  }) => {
    lastFileListProps = props;
    return (
      <div data-testid="file-list">
        {[...props.files, ...mockExtraFileListRows].map((entry, index) => (
          <div
            key={entry.path}
            data-testid={`file-row-${entry.name}`}
            data-entry-index={index}
            data-entry-path={entry.path}
            data-entry-name={entry.name}
            data-entry-kind={entry.kind}
            data-entry-is-hidden={entry.isHidden ? 'true' : 'false'}
          >
            {entry.name}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('./archiveEnter', () => ({
  enterArchiveEntry: vi.fn(),
  isArchiveEntry: vi.fn(() => false),
  isZipArchiveEntry: vi.fn(() => false),
}));

export const setMockExtraFileListRows = (entries: FileEntry[]) => {
  mockExtraFileListRows = entries;
};

export const setLeftPanelPath = (path: string) => {
  usePanelStore.setState((state) => ({
    ...state,
    leftPanel: {
      ...state.leftPanel,
      currentPath: path,
      files: [],
      tabs: state.leftPanel.tabs.map((tab) =>
        tab.id === state.leftPanel.activeTabId
          ? {
              ...tab,
              currentPath: path,
              history: [path],
              historyIndex: 0,
              files: [],
              selectedItems: new Set<string>(),
              pendingCursorName: null,
            }
          : tab
      ),
    },
    activePanel: 'left',
  }));
};

export const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

export const registerFilePanelTestLifecycle = () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
    lastFileListProps = null;
    mockExtraFileListRows = [];
    mockListDirectory.mockReset();
    mockGetHomeDir.mockReset();
    mockResolvePath.mockReset();
    mockResolvePath.mockImplementation(async (path: string) => path);
    mockGetDirSize.mockReset();
    mockOpenFile.mockReset();
    mockShowContextMenu.mockReset();
    mockShowContextMenu.mockResolvedValue(undefined);
    mockOpenContextMenu.mockReset();
    alertSpy.mockClear();
  });
};
