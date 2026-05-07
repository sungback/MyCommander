import { useCallback, useState } from "react";
import {
  getErrorMessage,
  type SearchResult,
  useFileSystem,
} from "../../hooks/useFileSystem";
import type { PanelState } from "../../types/file";
import type { SearchOptions } from "../../types/search";
import type { SearchOptionChange } from "./SearchOptionsFields";
import { createDefaultSearchOptions } from "./searchOptions";
import {
  filterRemovedSearchResults,
  getPanelAccessPath,
} from "./searchPreviewOperations";

type SearchFileSystem = Pick<ReturnType<typeof useFileSystem>, "searchFiles">;

interface UseSearchExecutionArgs {
  activePanel: PanelState;
  fs: SearchFileSystem;
}

export const useSearchExecution = ({
  activePanel,
  fs,
}: UseSearchExecutionArgs) => {
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(
    createDefaultSearchOptions
  );
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const resetSearchExecution = useCallback(() => {
    setSearchOptions(createDefaultSearchOptions());
    setShowAdvancedOptions(false);
    setSearchError(null);
    setSearchResults([]);
    setSearchProgress("");
  }, []);

  const updateSearchOption: SearchOptionChange = useCallback((key, value) => {
    setSearchOptions((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const toggleAdvancedOptions = useCallback(() => {
    setShowAdvancedOptions((current) => !current);
  }, []);

  const removeResultsFromList = useCallback((removedResults: SearchResult[]) => {
    setSearchResults((current) =>
      filterRemovedSearchResults(current, removedResults)
    );
  }, []);

  const handleSearch = useCallback(async (onSearchStart?: () => void) => {
    const query = searchOptions.query.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchResults([]);
    onSearchStart?.();
    setSearchError(null);
    setSearchProgress("");

    try {
      await fs.searchFiles(
        getPanelAccessPath(activePanel),
        {
          ...searchOptions,
          query,
        },
        (event) => {
          if (event.type === "ResultBatch") {
            setSearchResults((current) => [...current, ...event.payload]);
          } else if (event.type === "Progress") {
            setSearchProgress(event.payload.current_dir);
          } else if (event.type === "Finished") {
            setIsSearching(false);
            setSearchProgress("");
          }
        }
      );
    } catch (error) {
      console.error(error);
      setSearchError(getErrorMessage(error, "Search failed."));
      setIsSearching(false);
      setSearchProgress("");
    }
  }, [activePanel, fs, searchOptions]);

  return {
    searchOptions,
    showAdvancedOptions,
    searchResults,
    isSearching,
    searchProgress,
    searchError,
    setSearchError,
    resetSearchExecution,
    updateSearchOption,
    toggleAdvancedOptions,
    removeResultsFromList,
    handleSearch,
  };
};
