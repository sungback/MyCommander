import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelStore } from "../../store/panelStore";
import { FilePanel } from "./FilePanel";

const mockListDirectory = vi.fn();
const mockGetHomeDir = vi.fn();
const mockResolvePath = vi.fn();
const mockGetDirSize = vi.fn();
const mockOpenContextMenu = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    listDirectory: mockListDirectory,
    getHomeDir: mockGetHomeDir,
    resolvePath: mockResolvePath,
    getDirSize: mockGetDirSize,
  }),
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
  FileList: () => <div data-testid="file-list" />,
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
    mockListDirectory.mockReset();
    mockGetHomeDir.mockReset();
    mockResolvePath.mockReset();
    mockGetDirSize.mockReset();
    mockOpenContextMenu.mockReset();
    alertSpy.mockClear();
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
    mockResolvePath.mockResolvedValueOnce("/Users/back/Library/CloudStorage/Dropbox");
    mockGetDirSize.mockResolvedValue(0);

    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(mockResolvePath).toHaveBeenCalledWith("/Users/back/Dropbox");
    });

    await waitFor(() => {
      expect(usePanelStore.getState().leftPanel.currentPath).toBe(
        "/Users/back/Library/CloudStorage/Dropbox"
      );
    });

    expect(usePanelStore.getState().leftPanel.files).toEqual(resolvedEntries);
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
    mockResolvePath.mockResolvedValue("/Users/back/Dropbox");
    mockGetDirSize.mockResolvedValue(0);

    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(usePanelStore.getState().leftPanel.files).toEqual(homeEntries);
    });

    await act(async () => {
      usePanelStore.getState().setPath("left", "/Users/back/Dropbox");
    });

    await waitFor(() => {
      expect(usePanelStore.getState().leftPanel.currentPath).toBe("/Users/back");
    });

    expect(alertSpy).toHaveBeenCalledWith("permission denied");
  });
});
