import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../../types/file";
import {
  getAutomaticEstimateOptions,
  useBackgroundDirSizes,
} from "./useBackgroundDirSizes";

const { mockEstimateDirSize } = vi.hoisted(() => ({
  mockEstimateDirSize: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    estimateDirSize: mockEstimateDirSize,
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
  updateEntrySizeEstimate: vi.fn(),
  ...overrides,
});

describe("useBackgroundDirSizes", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockEstimateDirSize.mockReset();
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
  });
});
