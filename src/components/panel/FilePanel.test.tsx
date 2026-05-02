import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  alertSpy,
  lastFileListProps,
  mockGetDirSize,
  mockListDirectory,
  mockOpenContextMenu,
  mockResolvePath,
  mockShowContextMenu,
  registerFilePanelTestLifecycle,
  setLeftPanelPath,
  setMockExtraFileListRows,
} from './FilePanel.test-harness';
import { FilePanel } from './FilePanel';
import { usePanelStore } from '../../store/panelStore';
import type { FileEntry } from '../../types/file';

describe('FilePanel', () => {
  registerFilePanelTestLifecycle();

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

    setMockExtraFileListRows([expandedChild]);
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
        canNormalizeFilename: false,
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
        canNormalizeFilename: false,
        canCreateZip: false,
      })
    );
  });

  it("enables NFC filename conversion for decomposed target names", async () => {
    const nfdName = "머신.txt".normalize("NFD");
    const entry: FileEntry = {
      name: nfdName,
      path: `/home/user/${nfdName}`,
      kind: "file",
    };

    mockListDirectory.mockResolvedValue([entry]);

    setLeftPanelPath("/home/user");
    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(screen.getByTestId(`file-row-${nfdName}`)).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByTestId(`file-row-${nfdName}`), {
      clientX: 1,
      clientY: 2,
    });

    expect(mockShowContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        hasTargetItem: true,
        canRename: true,
        canNormalizeFilename: true,
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
