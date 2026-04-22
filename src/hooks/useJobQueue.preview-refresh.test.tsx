import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileList } from "../components/panel/FileList";
import { useDialogStore } from "../store/dialogStore";
import { useJobStore } from "../store/jobStore";
import { usePanelStore } from "../store/panelStore";
import { useSettingsStore } from "../store/settingsStore";
import { coalescePanelPath } from "../utils/path";
import { useJobQueue } from "./useJobQueue";
import type { FileEntry } from "../types/file";
import type { JobRecord } from "../types/job";

const {
  listenHandlers,
  mockCheckCopyConflicts,
  mockGetDirSize,
  mockListDirectory,
  mockListJobs,
  mockSubmitJob,
  mockStartDrag,
} = vi.hoisted(() => ({
  listenHandlers: new Map<string, (event: { payload: unknown }) => void>(),
  mockCheckCopyConflicts: vi.fn(),
  mockGetDirSize: vi.fn(),
  mockListDirectory: vi.fn(),
  mockListJobs: vi.fn(),
  mockSubmitJob: vi.fn(),
  mockStartDrag: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: (path: string) => `asset://${path}`,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockImplementation(
    async (eventName: string, handler: (event: { payload: unknown }) => void) => {
      listenHandlers.set(eventName, handler);
      return () => {
        listenHandlers.delete(eventName);
      };
    }
  ),
}));

vi.mock("@crabnebula/tauri-plugin-drag", () => ({
  startDrag: mockStartDrag,
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number }) => ({
    getTotalSize: () => opts.count * opts.estimateSize(),
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, index) => ({
        index,
        size: opts.estimateSize(),
        start: index * opts.estimateSize(),
      })),
    scrollToIndex: vi.fn(),
  }),
}));

vi.mock("./useFileSystem", () => ({
  useFileSystem: () => ({
    listJobs: mockListJobs,
    listDirectory: mockListDirectory,
    checkCopyConflicts: mockCheckCopyConflicts,
    submitJob: mockSubmitJob,
    getDirSize: mockGetDirSize,
  }),
}));

const buildZipEntry = (name: string): FileEntry => ({
  name,
  path: `/Users/back/_Dn/_abc/${name}`,
  kind: "file",
  size: name === "01.zip" ? 710_000 : name === "02.zip" ? 9_500_000 : 487_000,
  lastModified: 1,
});

const leftRootFiles: FileEntry[] = [
  { name: "..", path: "/Users/back", kind: "directory" },
  { name: "_abc", path: "/Users/back/_Dn/_abc", kind: "directory", size: null, lastModified: 1 },
];

const renderPanel = (panelId: "left" | "right") => {
  const panel = usePanelStore((state) => (panelId === "left" ? state.leftPanel : state.rightPanel));
  const activePanel = usePanelStore((state) => state.activePanel);
  const toggleSelection = usePanelStore((state) => state.toggleSelection);
  const setCursor = usePanelStore((state) => state.setCursor);

  return (
    <FileList
      currentPath={panel.currentPath}
      accessPath={coalescePanelPath(panel.resolvedPath, panel.currentPath)}
      files={panel.files}
      selectedItems={panel.selectedItems}
      cursorIndex={panel.cursorIndex}
      isActivePanel={activePanel === panelId}
      panelId={panelId}
      viewMode="detailed"
      onSelect={(path) => toggleSelection(panelId, path)}
      onEnter={() => {}}
      setCursorIndex={(index) => setCursor(panelId, index)}
    />
  );
};

const Harness = () => {
  useJobQueue();

  return (
    <>
      {renderPanel("left")}
      {renderPanel("right")}
    </>
  );
};

describe("useJobQueue + expanded preview refresh", () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
    useDialogStore.setState(useDialogStore.getInitialState());
    useJobStore.getState().resetJobs();
    useSettingsStore.setState({
      fontSize: 14,
      fontFamily: "",
      panelLeftRatio: 50,
    });

    listenHandlers.clear();
    mockListJobs.mockReset();
    mockListDirectory.mockReset();
    mockCheckCopyConflicts.mockReset();
    mockSubmitJob.mockReset();
    mockGetDirSize.mockReset();
    mockStartDrag.mockReset();

    mockListJobs.mockResolvedValue([]);
    mockCheckCopyConflicts.mockResolvedValue([]);
    mockSubmitJob.mockResolvedValue(undefined);
    mockGetDirSize.mockResolvedValue(0);

    usePanelStore.getState().setPath("left", "/Users/back/_Dn");
    usePanelStore.getState().setPath("right", "/Users/back/_Dn/_abc");
    usePanelStore.getState().setFiles("left", leftRootFiles);
    usePanelStore.getState().setFiles("right", [
      { name: "..", path: "/Users/back/_Dn", kind: "directory" },
      buildZipEntry("01.zip"),
      buildZipEntry("02.zip"),
      buildZipEntry("03.zip"),
    ]);
    usePanelStore.getState().setActivePanel("left");
  });

  it("removes a deleted file from the left expanded preview when the delete job completes", async () => {
    let expandedEntries = [
      buildZipEntry("01.zip"),
      buildZipEntry("02.zip"),
      buildZipEntry("03.zip"),
    ];

    mockListDirectory.mockImplementation(async (path: string) => {
      if (path === "/Users/back/_Dn/_abc") {
        return expandedEntries;
      }

      return [];
    });

    render(<Harness />);

    await act(async () => {
      await Promise.resolve();
    });

    const expandButton = document
      .querySelector('[data-entry-path="/Users/back/_Dn/_abc"]')
      ?.querySelector('[aria-label="Expand folder preview"]') as HTMLElement;

    await act(async () => {
      fireEvent.click(expandButton);
    });

    expect(
      document.querySelector('[data-entry-path="/Users/back/_Dn/_abc/03.zip"]')
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll('[data-entry-path="/Users/back/_Dn/_abc/03.zip"]')
    ).toHaveLength(2);

    const emitJobUpdate = listenHandlers.get("job-updated");
    expect(emitJobUpdate).toBeTypeOf("function");

    act(() => {
      emitJobUpdate?.({
        payload: {
          id: "job-1",
          kind: "delete",
          status: "running",
          createdAt: 1,
          updatedAt: 2,
          progress: { current: 0, total: 1, currentFile: "03.zip", unit: "items" },
          error: null,
          result: null,
        } satisfies JobRecord,
      });
    });

    expandedEntries = [buildZipEntry("01.zip"), buildZipEntry("02.zip")];

    act(() => {
      emitJobUpdate?.({
        payload: {
          id: "job-1",
          kind: "delete",
          status: "completed",
          createdAt: 1,
          updatedAt: 3,
          progress: { current: 1, total: 1, currentFile: "03.zip", unit: "items" },
          error: null,
          result: {
            affectedDirectories: ["/Users/back/_Dn/_abc"],
            affectedEntryPaths: ["/Users/back/_Dn/_abc/03.zip"],
            savedNames: [],
            archivePath: null,
          },
        } satisfies JobRecord,
      });
    });

    await waitFor(() => {
      expect(
        document.querySelector('[data-entry-path="/Users/back/_Dn/_abc/03.zip"]')
      ).not.toBeInTheDocument();
    });

    expect(
      document.querySelector('[data-entry-path="/Users/back/_Dn/_abc/01.zip"]')
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-entry-path="/Users/back/_Dn/_abc/02.zip"]')
    ).toBeInTheDocument();
  });
});
