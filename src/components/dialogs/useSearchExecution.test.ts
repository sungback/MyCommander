import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SearchEvent, useFileSystem } from "../../hooks/useFileSystem";
import type { PanelState } from "../../types/file";
import { useSearchExecution } from "./useSearchExecution";

const panel: PanelState = {
  id: "left",
  currentPath: "/display/search",
  resolvedPath: "/resolved/search",
  history: [],
  historyIndex: -1,
  files: [],
  selectedItems: new Set(),
  cursorIndex: 0,
  sortField: "name",
  sortDirection: "asc",
  lastUpdated: 0,
  pendingCursorName: null,
  tabs: [],
  activeTabId: "tab",
};

const createFs = (
  searchFiles: ReturnType<typeof vi.fn>
): Pick<ReturnType<typeof useFileSystem>, "searchFiles"> =>
  ({
    searchFiles,
  }) as Pick<ReturnType<typeof useFileSystem>, "searchFiles">;

describe("useSearchExecution", () => {
  it("runs a trimmed search against the panel access path", async () => {
    const clearSearchSelection = vi.fn();
    const searchFiles = vi.fn(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        onEvent({
          type: "ResultBatch",
          payload: [
            {
              name: "notes.txt",
              path: "/resolved/search/notes.txt",
              size: 12,
              is_dir: false,
            },
          ],
        });
        onEvent({ type: "Finished", payload: { total_matches: 1 } });
      }
    );
    const { result } = renderHook(() =>
      useSearchExecution({
        activePanel: panel,
        fs: createFs(searchFiles),
      })
    );

    act(() => {
      result.current.updateSearchOption("query", "  notes  ");
    });
    await act(async () => {
      await result.current.handleSearch(clearSearchSelection);
    });

    expect(searchFiles).toHaveBeenCalledWith(
      "/resolved/search",
      expect.objectContaining({ query: "notes" }),
      expect.any(Function)
    );
    expect(clearSearchSelection).toHaveBeenCalledTimes(1);
    expect(result.current.searchResults).toEqual([
      {
        name: "notes.txt",
        path: "/resolved/search/notes.txt",
        size: 12,
        is_dir: false,
      },
    ]);
    expect(result.current.isSearching).toBe(false);
  });

  it("stores search failures and clears progress", async () => {
    const searchFiles = vi.fn(async () => {
      throw new Error("search failed");
    });
    const { result } = renderHook(() =>
      useSearchExecution({
        activePanel: panel,
        fs: createFs(searchFiles),
      })
    );

    act(() => {
      result.current.updateSearchOption("query", "notes");
    });
    await act(async () => {
      await result.current.handleSearch();
    });

    expect(result.current.searchError).toBe("search failed");
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchProgress).toBe("");
  });

  it("resets search options, results, progress, and advanced state", async () => {
    const clearSearchSelection = vi.fn();
    const searchFiles = vi.fn(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        onEvent({
          type: "ResultBatch",
          payload: [{ name: "notes.txt", path: "/notes.txt", is_dir: false }],
        });
        onEvent({ type: "Finished", payload: { total_matches: 1 } });
      }
    );
    const { result } = renderHook(() =>
      useSearchExecution({
        activePanel: panel,
        fs: createFs(searchFiles),
      })
    );

    act(() => {
      result.current.updateSearchOption("query", "notes");
      result.current.toggleAdvancedOptions();
    });
    await act(async () => {
      await result.current.handleSearch(clearSearchSelection);
    });

    act(() => {
      result.current.resetSearchExecution();
    });

    await waitFor(() => {
      expect(result.current.searchOptions.query).toBe("");
    });
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.showAdvancedOptions).toBe(false);
    expect(result.current.searchProgress).toBe("");
    expect(clearSearchSelection).toHaveBeenCalledTimes(1);
  });
});
