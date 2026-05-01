import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../hooks/useFileSystem";
import { useSearchResultSelection } from "./useSearchResultSelection";

const results: SearchResult[] = [
  { name: "first.txt", path: "/search/first.txt", size: 10, is_dir: false },
  { name: "second.txt", path: "/search/second.txt", size: 20, is_dir: false },
];

describe("useSearchResultSelection", () => {
  it("toggles selected result paths", () => {
    const { result } = renderHook(() => useSearchResultSelection(results));

    act(() => {
      result.current.toggleSearchResultSelection("/search/first.txt");
    });
    expect([...result.current.selectedSearchPaths]).toEqual([
      "/search/first.txt",
    ]);
    expect(result.current.getSelectedSearchResults()).toEqual([results[0]]);

    act(() => {
      result.current.toggleSearchResultSelection("/search/first.txt");
    });
    expect([...result.current.selectedSearchPaths]).toEqual([]);
  });

  it("selects and clears all current search results", () => {
    const { result } = renderHook(() => useSearchResultSelection(results));

    act(() => {
      result.current.selectAllSearchResults();
    });
    expect([...result.current.selectedSearchPaths]).toEqual([
      "/search/first.txt",
      "/search/second.txt",
    ]);

    act(() => {
      result.current.clearSearchSelection();
    });
    expect([...result.current.selectedSearchPaths]).toEqual([]);
  });
});
