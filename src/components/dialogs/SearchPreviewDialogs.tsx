import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Resizable } from "re-resizable";
import {
  getErrorMessage,
  type SearchResult,
  useFileSystem,
} from "../../hooks/useFileSystem";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import type { SearchOptions } from "../../types/search";
import { SearchOperationDialog } from "./SearchOperationDialog";
import {
  SearchOptionsFields,
  type SearchOptionChange,
} from "./SearchOptionsFields";
import { SearchResultsPanel } from "./SearchResultsPanel";
import { createDefaultSearchOptions } from "./searchOptions";
import {
  filterRemovedSearchResults,
  getPanelAccessPath,
} from "./searchPreviewOperations";
import { useSearchResultOperations } from "./useSearchResultOperations";
import { useSearchResultSelection } from "./useSearchResultSelection";

const SEARCH_DIALOG_SIZE_KEY = "mycommander:search-dialog-size";
const DEFAULT_DIALOG_SIZE = { width: 700, height: 560 };

export const SearchPreviewDialogs: React.FC = () => {
  const { openDialog, closeDialog } = useDialogStore();
  const fs = useFileSystem();

  const activePanelId = usePanelStore((state) => state.activePanel);
  const leftPanel = usePanelStore((state) => state.leftPanel);
  const rightPanel = usePanelStore((state) => state.rightPanel);
  const activePanel = activePanelId === "left" ? leftPanel : rightPanel;
  const targetPanel = activePanelId === "left" ? rightPanel : leftPanel;

  const [searchOptions, setSearchOptions] = useState<SearchOptions>(
    createDefaultSearchOptions
  );
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const {
    selectedSearchPaths,
    clearSearchSelection,
    selectAllSearchResults,
    toggleSearchResultSelection,
    getSelectedSearchResults,
  } = useSearchResultSelection(searchResults);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dialogSize, setDialogSize] = useState<{ width: number; height: number }>(
    () => {
      try {
        const saved = localStorage.getItem(SEARCH_DIALOG_SIZE_KEY);
        if (saved) return JSON.parse(saved) as { width: number; height: number };
      } catch {
        // ignore storage parse failure
      }
      return DEFAULT_DIALOG_SIZE;
    }
  );

  const handleSearch = async () => {
    const query = searchOptions.query.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchResults([]);
    clearSearchSelection();
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
  };

  const removeResultsFromList = (removedResults: SearchResult[]) => {
    setSearchResults((current) =>
      filterRemovedSearchResults(current, removedResults)
    );
  };

  const {
    isDeletingSearchResults,
    searchOperation,
    searchOperationTarget,
    isApplyingSearchOperation,
    searchOperationError,
    resetSearchOperation,
    openSearchOperationDialog,
    closeSearchOperationDialog,
    handleDeleteSearchResults,
    handleSearchOperation,
    updateSearchOperationTarget,
  } = useSearchResultOperations({
    selectedCount: selectedSearchPaths.size,
    getSelectedSearchResults,
    clearSearchSelection,
    removeResultsFromList,
    targetPanel,
    fs,
    setSearchError,
  });

  useEffect(() => {
    if (openDialog !== "search") {
      setSearchOptions(createDefaultSearchOptions());
      setShowAdvancedOptions(false);
      setSearchError(null);
      setSearchResults([]);
      clearSearchSelection();
      resetSearchOperation();
      setSearchProgress("");
    }
  }, [clearSearchSelection, openDialog, resetSearchOperation]);

  const updateSearchOption: SearchOptionChange = (key, value) => {
    setSearchOptions((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <>
      <Dialog.Root open={openDialog === "search"} onOpenChange={(open) => !open && closeDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 focus:outline-none">
            <Resizable
              size={dialogSize}
              minWidth={560}
              minHeight={420}
              maxWidth={Math.round(window.innerWidth * 0.95)}
              maxHeight={Math.round(window.innerHeight * 0.92)}
              enable={{
                right: true,
                bottom: true,
                bottomRight: true,
                left: false,
                top: false,
                topLeft: false,
                topRight: false,
                bottomLeft: false,
              }}
              onResizeStop={(_event, _direction, _ref, delta) => {
                const newSize = {
                  width: dialogSize.width + delta.width,
                  height: dialogSize.height + delta.height,
                };
                setDialogSize(newSize);
                try {
                  localStorage.setItem(
                    SEARCH_DIALOG_SIZE_KEY,
                    JSON.stringify(newSize)
                  );
                } catch {
                  // ignore storage failure
                }
              }}
              handleComponent={{
                bottomRight: (
                  <div className="absolute bottom-1 right-1 w-3 h-3 opacity-40 hover:opacity-90 transition-opacity">
                    <svg
                      viewBox="0 0 8 8"
                      fill="currentColor"
                      className="text-text-secondary w-full h-full"
                    >
                      <circle cx="6" cy="6" r="1" />
                      <circle cx="3" cy="6" r="1" />
                      <circle cx="6" cy="3" r="1" />
                    </svg>
                  </div>
                ),
              }}
              className="bg-bg-panel border border-border-color rounded shadow-xl text-text-primary overflow-hidden"
              style={{ display: "flex", flexDirection: "column" }}
            >
              <div className="p-4 flex flex-col h-full overflow-hidden">
                <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-2">
                  Search in {activePanel.currentPath}
                </Dialog.Title>

                <div className="flex gap-2 mb-3">
                  <input
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={searchOptions.query}
                    onChange={(event) =>
                      updateSearchOption("query", event.target.value)
                    }
                    onKeyDown={(event) =>
                      event.key === "Enter" && void handleSearch()
                    }
                    placeholder="Find files..."
                    className="flex-1 bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOptions((current) => !current)}
                    className="px-3 py-1.5 text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color"
                    aria-expanded={showAdvancedOptions}
                  >
                    Advanced
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSearch()}
                    disabled={isSearching}
                    className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSearching ? "Searching..." : "Search"}
                  </button>
                </div>

                {showAdvancedOptions ? (
                  <SearchOptionsFields
                    searchOptions={searchOptions}
                    onChange={updateSearchOption}
                  />
                ) : null}

                <SearchResultsPanel
                  searchOptionsQuery={searchOptions.query}
                  searchResults={searchResults}
                  selectedSearchPaths={selectedSearchPaths}
                  isSearching={isSearching}
                  isDeletingSearchResults={isDeletingSearchResults}
                  searchProgress={searchProgress}
                  searchError={searchError}
                  onSelectAll={selectAllSearchResults}
                  onClearSelection={clearSearchSelection}
                  onOpenOperation={openSearchOperationDialog}
                  onDelete={() => void handleDeleteSearchResults()}
                  onToggleSelection={toggleSearchResultSelection}
                />

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="px-4 py-1.5 text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color"
                  >
                    Close
                  </button>
                </div>
              </div>
            </Resizable>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <SearchOperationDialog
        operation={searchOperation}
        selectedCount={selectedSearchPaths.size}
        target={searchOperationTarget}
        error={searchOperationError}
        isApplying={isApplyingSearchOperation}
        onClose={closeSearchOperationDialog}
        onTargetChange={updateSearchOperationTarget}
        onSubmit={() => void handleSearchOperation()}
      />
    </>
  );
};
