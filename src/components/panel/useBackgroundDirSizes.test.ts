import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../../types/file";
import {
  getAutomaticEstimateOptions,
  shouldAutoScanExactSizes,
  useBackgroundDirSizes,
} from "./useBackgroundDirSizes";

const { listenHandlers, mockCancelDirSizeScan, mockEstimateDirSize, mockScanDirSize } =
vi.hoisted(() => ({
  listenHandlers: new Map<string, (event: { payload: unknown }) => void>(),
  mockCancelDirSizeScan: vi.fn(),
  mockEstimateDirSize: vi.fn(),
  mockScanDirSize: vi.fn(),
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

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    cancelDirSizeScan: mockCancelDirSizeScan,
    estimateDirSize: mockEstimateDirSize,
    scanDirSize: mockScanDirSize,
  }),
}));

const makeDirectory = (path: string): FileEntry => ({
  name: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
  path,
  kind: "directory",
});

const makeProps = (overrides = {}) => ({
  activeTabId: "tab-1",
  currentPath: "C:\\",
  files: [makeDirectory("C:\\Windows")],
  lastUpdated: 0,
  panelId: "left" as const,
  setEntrySizeStatus: vi.fn(),
  updateEntrySize: vi.fn(),
  updateEntrySizeEstimate: vi.fn(),
  updateEntrySizeProgress: vi.fn(),
  ...overrides,
});

describe("useBackgroundDirSizes", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    listenHandlers.clear();
    mockCancelDirSizeScan.mockReset();
    mockEstimateDirSize.mockReset();
    mockScanDirSize.mockReset();
    mockScanDirSize.mockResolvedValue({
      size: 2048,
      isPartial: false,
      scannedEntries: 2,
      errorCount: 0,
    });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("does not requeue the same unresolved directory after a size calculation settles", async () => {
    mockEstimateDirSize.mockResolvedValue({
      size: 1024,
      isPartial: false,
      scannedEntries: 1,
    });
    const props = makeProps();
    const { rerender } = renderHook(
      (hookProps: ReturnType<typeof makeProps>) =>
        useBackgroundDirSizes(hookProps),
      { initialProps: props }
    );

    await waitFor(() =>
      expect(props.updateEntrySizeEstimate).toHaveBeenCalledWith(
        "left",
        "C:\\Windows",
        1024,
        "estimated"
      )
    );

    rerender({
      ...props,
      files: [...props.files],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockEstimateDirSize).toHaveBeenCalledTimes(1);
  });

  it("marks failed calculations as settled until the panel is refreshed", async () => {
    mockEstimateDirSize.mockRejectedValue(new Error("access denied"));
    const props = makeProps();
    const { rerender } = renderHook(
      (hookProps: ReturnType<typeof makeProps>) =>
        useBackgroundDirSizes(hookProps),
      { initialProps: props }
    );

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledTimes(1));

    rerender({
      ...props,
      files: [...props.files],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockEstimateDirSize).toHaveBeenCalledTimes(1);

    rerender({
      ...props,
      lastUpdated: 1,
    });

    await waitFor(() => expect(mockEstimateDirSize).toHaveBeenCalledTimes(2));
  });

  it("uses shallower estimates for filesystem roots", () => {
    expect(getAutomaticEstimateOptions("C:\\")).toEqual({
      maxDepth: 0,
      maxEntries: 100,
    });
    expect(getAutomaticEstimateOptions("/")).toEqual({
      maxDepth: 0,
      maxEntries: 100,
    });
    expect(getAutomaticEstimateOptions("/Users/sam")).toEqual({
      maxDepth: 1,
      maxEntries: 200,
    });
    expect(shouldAutoScanExactSizes("C:\\")).toBe(false);
    expect(shouldAutoScanExactSizes("/Users/sam")).toBe(true);
  });

  it("runs an exact background scan for estimated directories outside roots", async () => {
    const props = makeProps({
      currentPath: "/Users/sam",
      files: [
        {
          ...makeDirectory("/Users/sam/Projects"),
          size: 1024,
          sizeStatus: "estimated" as const,
        },
      ],
    });

    renderHook((hookProps: ReturnType<typeof makeProps>) =>
      useBackgroundDirSizes(hookProps), {
      initialProps: props,
    });

    await waitFor(() =>
      expect(mockScanDirSize).toHaveBeenCalledWith(
        "/Users/sam/Projects",
        expect.stringMatching(/^left-/)
      )
    );
    await waitFor(() =>
      expect(props.updateEntrySize).toHaveBeenCalledWith(
        "left",
        "/Users/sam/Projects",
        2048
      )
    );
  });

  it("applies scan progress events to the matching active scan", async () => {
    let resolveScan: (value: {
      size: number;
      isPartial: boolean;
      scannedEntries: number;
      errorCount: number;
    }) => void = () => {};
    mockScanDirSize.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        })
    );
    const props = makeProps({
      currentPath: "/Users/sam",
      files: [
        {
          ...makeDirectory("/Users/sam/Projects"),
          size: 1024,
          sizeStatus: "partial" as const,
        },
      ],
    });

    renderHook((hookProps: ReturnType<typeof makeProps>) =>
      useBackgroundDirSizes(hookProps), {
      initialProps: props,
    });

    await waitFor(() => expect(mockScanDirSize).toHaveBeenCalledTimes(1));
    const scanId = mockScanDirSize.mock.calls[0][1];
    listenHandlers.get("dir-size-progress")?.({
      payload: {
        scanId,
        path: "/Users/sam/Projects",
        size: 1536,
        isPartial: false,
        scannedEntries: 4,
        completed: false,
      },
    });

    expect(props.updateEntrySizeProgress).toHaveBeenCalledWith(
      "left",
      "/Users/sam/Projects",
      1536
    );

    resolveScan({
      size: 2048,
      isPartial: false,
      scannedEntries: 5,
      errorCount: 0,
    });
  });
});
