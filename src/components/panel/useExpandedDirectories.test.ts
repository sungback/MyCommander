import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../../types/file";
import { useExpandedDirectories } from "./useExpandedDirectories";

const makeDirectory = (path: string): FileEntry => ({
  name: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
  path,
  kind: "directory",
});

describe("useExpandedDirectories", () => {
  it("uses a bounded cloud estimate for expanded children under My Drive", async () => {
    const parent = makeDirectory("G:\\내 드라이브\\Projects");
    const child = makeDirectory("G:\\내 드라이브\\Projects\\Archive");
    const estimateDirSize = vi.fn().mockResolvedValue({
      size: 4096,
      isPartial: false,
      scannedEntries: 3,
    });
    const listDirectory = vi.fn().mockResolvedValue([child]);
    const updateEntrySize = vi.fn();
    const updateEntrySizeEstimate = vi.fn();
    const props = {
      currentPath: "G:\\내 드라이브",
      expandedChildrenVersion: 0,
      files: [parent],
      estimateDirSize,
      listDirectory,
      panelId: "left" as const,
      refreshKey: 0,
      showHiddenFiles: false,
      setCursorIndex: vi.fn(),
      setEntrySizeStatus: vi.fn(),
      updateEntrySize,
      updateEntrySizeEstimate,
      focusContainer: vi.fn(),
    };

    const { result } = renderHook(() =>
      useExpandedDirectories(props)
    );

    await act(async () => {
      await result.current.toggleExpanded(0, parent);
    });

    await waitFor(() =>
      expect(estimateDirSize).toHaveBeenCalledWith(
        "G:\\내 드라이브\\Projects\\Archive",
        { maxDepth: 4, maxEntries: 2000 }
      )
    );
    await waitFor(() =>
      expect(updateEntrySize).toHaveBeenCalledWith(
        "left",
        "G:\\내 드라이브\\Projects\\Archive",
        4096
      )
    );
    expect(updateEntrySizeEstimate).not.toHaveBeenCalledWith(
      "left",
      "G:\\내 드라이브\\Projects\\Archive",
      4096,
      "estimated"
    );
  });
});
