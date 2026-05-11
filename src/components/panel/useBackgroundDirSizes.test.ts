import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../../types/file";
import { useBackgroundDirSizes } from "./useBackgroundDirSizes";

const { mockGetDirSize } = vi.hoisted(() => ({
  mockGetDirSize: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    getDirSize: mockGetDirSize,
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
  updateEntrySize: vi.fn(),
  ...overrides,
});

describe("useBackgroundDirSizes", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGetDirSize.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("does not requeue the same unresolved directory after a size calculation settles", async () => {
    mockGetDirSize.mockResolvedValue(1024);
    const props = makeProps();
    const { rerender } = renderHook(
      (hookProps: ReturnType<typeof makeProps>) =>
        useBackgroundDirSizes(hookProps),
      { initialProps: props }
    );

    await waitFor(() =>
      expect(props.updateEntrySize).toHaveBeenCalledWith(
        "left",
        "C:\\Windows",
        1024
      )
    );

    rerender({
      ...props,
      files: [...props.files],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockGetDirSize).toHaveBeenCalledTimes(1);
  });

  it("marks failed calculations as settled until the panel is refreshed", async () => {
    mockGetDirSize.mockRejectedValue(new Error("access denied"));
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
    expect(mockGetDirSize).toHaveBeenCalledTimes(1);

    rerender({
      ...props,
      lastUpdated: 1,
    });

    await waitFor(() => expect(mockGetDirSize).toHaveBeenCalledTimes(2));
  });
});
