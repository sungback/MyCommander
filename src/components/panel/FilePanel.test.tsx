import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelStore } from "../../store/panelStore";
import { FileEntry } from "../../types/file";
import { FilePanel } from "./FilePanel";

const mockListDirectory = vi.fn();
const mockGetHomeDir = vi.fn();
const mockResolvePath = vi.fn();
const mockGetDirSize = vi.fn();
const mockOpenFile = vi.fn();
const mockShowContextMenu = vi.fn();
const mockOpenContextMenu = vi.fn();
let lastFileListProps: {
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

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => mockFileSystem,
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback,
}));

vi.mock("../../store/contextMenuStore", () => ({
  useContextMenuStore: (selector: (state: { openContextMenu: typeof mockOpenContextMenu }) => unknown) =>
    selector({ openContextMenu: mockOpenContextMenu }),
}));

vi.mock("./AddressBar", () => ({
  AddressBar: () => <div data-testid="address-bar" />,
}));

vi.mock("./ColumnHeader", () => ({
  ColumnHeader: () => <div data-testid="column-header" />,
}));

vi.mock("./DriveList", () => ({
  DriveList: () => <div data-testid="drive-list" />,
}));

vi.mock("./TabBar", () => ({
  TabBar: () => <div data-testid="tab-bar" />,
}));

vi.mock("./FileList", () => ({
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
            data-entry-is-hidden={entry.isHidden ? "true" : "false"}
          >
            {entry.name}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("./archiveEnter", () => ({
  enterArchiveEntry: vi.fn(),
  isArchiveEntry: vi.fn(() => false),
  isZipArchiveEntry: vi.fn(() => false),
}));

const setLeftPanelPath = (path: string) => {
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
    activePanel: "left",
  }));
};

describe("FilePanel", () => {
  const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

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

  it("uses DOM metadata for context menus on expanded child entries", async () => {
    const rootEntry: FileEntry = {
      name: "Project",
      path: "/home/user/Project",
      kind: "directory",
      size: null,
    };
    const expandedChild: FileEntry = {
      name: "nested.txt",
      path: "/home/user/Project/nested.txt",
      kind: "file",
    };

    mockExtraFileListRows = [expandedChild];
    mockListDirectory.mockResolvedValue([rootEntry]);
    mockGetDirSize.mockResolvedValue(0);

    setLeftPanelPath("/home/user");
    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(screen.getByTestId("file-row-nested.txt")).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByTestId("file-row-nested.txt"), {
      clientX: 12,
      clientY: 34,
    });

    expect(mockOpenContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        panelId: "left",
        targetPath: "/home/user/Project/nested.txt",
        targetEntry: expect.objectContaining({
          name: "nested.txt",
          path: "/home/user/Project/nested.txt",
          kind: "file",
        }),
        x: 12,
        y: 34,
      })
    );
    expect(mockShowContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        hasTargetItem: true,
        canRename: true,
        canCreateZip: false,
        canExtractZip: false,
      })
    );
  });

  it("does not keep stale multi-selection capabilities when right-clicking an unselected file", async () => {
    const entries: FileEntry[] = [
      { name: "alpha.txt", path: "/home/user/alpha.txt", kind: "file" },
      { name: "bravo.txt", path: "/home/user/bravo.txt", kind: "file" },
      { name: "target.txt", path: "/home/user/target.txt", kind: "file" },
    ];

    mockListDirectory.mockResolvedValue(entries);

    setLeftPanelPath("/home/user");
    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(screen.getByTestId("file-row-target.txt")).toBeInTheDocument();
    });

    act(() => {
      usePanelStore
        .getState()
        .setSelection("left", ["/home/user/alpha.txt", "/home/user/bravo.txt"]);
    });

    fireEvent.contextMenu(screen.getByTestId("file-row-target.txt"), {
      clientX: 1,
      clientY: 2,
    });

    expect(Array.from(usePanelStore.getState().leftPanel.selectedItems)).toEqual([
      "/home/user/target.txt",
    ]);
    expect(mockShowContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        hasTargetItem: true,
        canRename: true,
        canCreateZip: false,
      })
    );
  });

  it("fills missing directory sizes in the background", async () => {
    const entries: FileEntry[] = [
      { name: "Documents", path: "/home/user/Documents", kind: "directory", size: null },
      { name: "Downloads", path: "/home/user/Downloads", kind: "directory" },
      { name: "notes.txt", path: "/home/user/notes.txt", kind: "file" },
    ];

    mockListDirectory.mockResolvedValue(entries);
    mockGetDirSize.mockResolvedValue(42);

    setLeftPanelPath("/home/user");
    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(mockGetDirSize).toHaveBeenCalledWith("/home/user/Documents");
      expect(mockGetDirSize).toHaveBeenCalledWith("/home/user/Downloads");
    });

    await waitFor(() => {
      const files = usePanelStore.getState().leftPanel.files;
      expect(files.find((entry) => entry.name === "Documents")?.size).toBe(42);
      expect(files.find((entry) => entry.name === "Downloads")?.size).toBe(42);
    });
  });

  it("retries with the resolved path when a symlinked folder load fails", async () => {
    const resolvedEntries = [
      { name: "..", path: "/Users/back/Library/CloudStorage", kind: "directory" as const },
      {
        name: "Docs",
        path: "/Users/back/Library/CloudStorage/Dropbox/Docs",
        kind: "directory" as const,
        size: null,
      },
    ];

    setLeftPanelPath("/Users/back/Dropbox");
    mockListDirectory.mockImplementation(async (path: string) => {
      if (path === "/Users/back/Dropbox") {
        throw new Error("permission denied");
      }

      if (path === "/Users/back/Library/CloudStorage/Dropbox") {
        return resolvedEntries;
      }

      throw new Error(`unexpected path: ${path}`);
    });
    mockResolvePath.mockImplementation(async (path: string) =>
      path === "/Users/back/Dropbox"
        ? "/Users/back/Library/CloudStorage/Dropbox"
        : path
    );
    mockGetDirSize.mockResolvedValue(0);

    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(mockResolvePath).toHaveBeenCalledWith("/Users/back/Dropbox");
    });

    expect(usePanelStore.getState().leftPanel.currentPath).toBe("/Users/back/Dropbox");
    expect(usePanelStore.getState().leftPanel.resolvedPath).toBe(
      "/Users/back/Library/CloudStorage/Dropbox"
    );
    expect(usePanelStore.getState().leftPanel.files).toEqual([
      resolvedEntries[0],
      { ...resolvedEntries[1], size: 0 },
    ]);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("returns to the previous folder and shows the real error when loading fails", async () => {
    const homeEntries = [
      { name: "..", path: "/Users", kind: "directory" as const },
      { name: "Dropbox", path: "/Users/back/Dropbox", kind: "directory" as const, size: null },
    ];

    setLeftPanelPath("/Users/back");
    mockListDirectory.mockImplementation(async (path: string) => {
      if (path === "/Users/back") {
        return homeEntries;
      }

      throw new Error("permission denied");
    });
    mockResolvePath.mockImplementation(async (path: string) => path);
    mockGetDirSize.mockResolvedValue(0);

    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(usePanelStore.getState().leftPanel.files).toEqual([
        homeEntries[0],
        { ...homeEntries[1], size: 0 },
      ]);
    });

    await act(async () => {
      usePanelStore.getState().setPath("left", "/Users/back/Dropbox");
    });

    await waitFor(() => {
      expect(usePanelStore.getState().leftPanel.currentPath).toBe("/Users/back");
    });

    expect(alertSpy).toHaveBeenCalledWith("permission denied");
  });

  it("enters symlinked directories on open", async () => {
    const symlinkEntry = {
      name: "Dropbox",
      path: "/Users/back/Dropbox",
      kind: "symlink" as const,
      size: 40,
    };

    mockListDirectory.mockImplementation(async (path: string) => {
      if (path === "/Users/back") {
        return [symlinkEntry];
      }

      if (path === "/Users/back/Library/CloudStorage/Dropbox") {
        return [];
      }

      throw new Error(`unexpected path: ${path}`);
    });
    mockResolvePath.mockImplementation(async (path: string) =>
      path === "/Users/back/Dropbox"
        ? "/Users/back/Library/CloudStorage/Dropbox"
        : path
    );
    mockGetDirSize.mockResolvedValue(0);

    setLeftPanelPath("/Users/back");
    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(lastFileListProps).not.toBeNull();
      expect(usePanelStore.getState().leftPanel.files).toEqual([symlinkEntry]);
    });

    await act(async () => {
      await lastFileListProps?.onEnter(symlinkEntry);
    });

    expect(mockResolvePath).toHaveBeenCalledWith("/Users/back/Dropbox");
    expect(usePanelStore.getState().leftPanel.currentPath).toBe("/Users/back/Dropbox");
  });

  it("enters Dropbox-like directories even when they are listed as directories", async () => {
    const dropboxEntry = {
      name: "Dropbox",
      path: "/Users/back/Dropbox",
      kind: "directory" as const,
      size: null,
    };

    mockListDirectory.mockImplementation(async (path: string) => {
      if (path === "/Users/back") {
        return [dropboxEntry];
      }

      if (path === "/Users/back/Library/CloudStorage/Dropbox") {
        return [];
      }

      throw new Error(`unexpected path: ${path}`);
    });
    mockResolvePath.mockImplementation(async (path: string) =>
      path === "/Users/back/Dropbox"
        ? "/Users/back/Library/CloudStorage/Dropbox"
        : path
    );
    mockGetDirSize.mockResolvedValue(0);

    setLeftPanelPath("/Users/back");
    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(lastFileListProps).not.toBeNull();
      expect(usePanelStore.getState().leftPanel.files).toEqual([
        { ...dropboxEntry, size: 0 },
      ]);
    });

    await act(async () => {
      await lastFileListProps?.onEnter(dropboxEntry);
    });

    expect(mockResolvePath).toHaveBeenCalledWith("/Users/back/Dropbox");
    expect(mockListDirectory).toHaveBeenCalledWith(
      "/Users/back/Library/CloudStorage/Dropbox",
      false
    );
    expect(usePanelStore.getState().leftPanel.currentPath).toBe("/Users/back/Dropbox");
  });
});
