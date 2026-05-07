import { useCallback, useState } from "react";
import type { SearchResult } from "../../hooks/useFileSystem";

export const useSearchResultSelection = (searchResults: SearchResult[]) => {
  const [selectedSearchPaths, setSelectedSearchPaths] = useState<Set<string>>(
    new Set()
  );

  const clearSearchSelection = useCallback(() => {
    setSelectedSearchPaths(new Set());
  }, []);

  const selectAllSearchResults = useCallback(() => {
    setSelectedSearchPaths(new Set(searchResults.map((result) => result.path)));
  }, [searchResults]);

  const toggleSearchResultSelection = useCallback((path: string) => {
    setSelectedSearchPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const getSelectedSearchResults = useCallback(
    () => searchResults.filter((result) => selectedSearchPaths.has(result.path)),
    [searchResults, selectedSearchPaths]
  );

  return {
    selectedSearchPaths,
    clearSearchSelection,
    selectAllSearchResults,
    toggleSearchResultSelection,
    getSelectedSearchResults,
  };
};
