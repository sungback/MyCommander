import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDialogStore } from "../../store/dialogStore";
import { getErrorMessage, SearchResult, useFileSystem } from "../../hooks/useFileSystem";
import { usePanelStore } from "../../store/panelStore";
import { isAbsolutePath, joinPath } from "../../utils/path";
import { File, Folder } from "lucide-react";

export const SearchPreviewDialogs: React.FC = () => {
  const { openDialog, closeDialog } = useDialogStore();
  const fs = useFileSystem();
  
  const activePanelId = usePanelStore((s) => s.activePanel);
  const leftPanel = usePanelStore((s) => s.leftPanel);
  const rightPanel = usePanelStore((s) => s.rightPanel);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const activePanel = activePanelId === "left" ? leftPanel : rightPanel;
  const targetPanel = activePanelId === "left" ? rightPanel : leftPanel;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedSearchPaths, setSelectedSearchPaths] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isDeletingSearchResults, setIsDeletingSearchResults] = useState(false);
  const [searchOperation, setSearchOperation] = useState<"copy" | "move" | null>(null);
  const [searchOperationTarget, setSearchOperationTarget] = useState("");
  const [isApplyingSearchOperation, setIsApplyingSearchOperation] = useState(false);
  const [searchOperationError, setSearchOperationError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);


  useEffect(() => {
    if (openDialog !== "search") {
      setSearchError(null);
      setSearchResults([]);
      setSelectedSearchPaths(new Set());
      setSearchOperation(null);
      setSearchOperationTarget("");
      setSearchOperationError(null);
    }
  }, [openDialog]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchResults([]);
    setSelectedSearchPaths(new Set());
    setSearchError(null);
    try {
      const results = await fs.searchFiles(activePanel.currentPath, searchQuery, false);
      setSearchResults(results);
    } catch (e) {
      console.error(e);
      setSearchError(getErrorMessage(e, "Search failed."));
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSearchResultSelection = (path: string) => {
    setSelectedSearchPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelectAllSearchResults = () => {
    setSelectedSearchPaths(new Set(searchResults.map((result) => result.path)));
  };

  const handleClearSearchSelection = () => {
    setSelectedSearchPaths(new Set());
  };

  const isSearchResultDescendantOf = (path: string, parentPath: string) =>
    path === parentPath ||
    path.startsWith(`${parentPath}/`) ||
    path.startsWith(`${parentPath}\\`);

  const getSelectedSearchResults = () =>
    searchResults.filter((result) => selectedSearchPaths.has(result.path));

  const getCollapsedSearchResults = (results: SearchResult[]) =>
    results.filter(
      (candidate) =>
        !results.some(
          (other) =>
            other.path !== candidate.path &&
            other.is_dir &&
            isSearchResultDescendantOf(candidate.path, other.path)
        )
    );

  const removeResultsFromList = (removedResults: SearchResult[]) => {
    setSearchResults((current) =>
      current.filter(
        (result) =>
          !removedResults.some((selected) =>
            selected.is_dir
              ? isSearchResultDescendantOf(result.path, selected.path)
              : result.path === selected.path
          )
      )
    );
  };

  const openSearchOperationDialog = (operation: "copy" | "move") => {
    if (selectedSearchPaths.size === 0) {
      return;
    }

    setSearchOperation(operation);
    setSearchOperationTarget(targetPanel.currentPath);
    setSearchOperationError(null);
  };

  const closeSearchOperationDialog = () => {
    if (isApplyingSearchOperation) {
      return;
    }

    setSearchOperation(null);
    setSearchOperationTarget("");
    setSearchOperationError(null);
  };

  const handleDeleteSearchResults = async () => {
    const selectedResults = getCollapsedSearchResults(getSelectedSearchResults());

    if (selectedResults.length === 0) {
      return;
    }

    try {
      setIsDeletingSearchResults(true);
      setSearchError(null);
      await fs.deleteFiles(
        selectedResults.map((result) => result.path),
        false
      );

      removeResultsFromList(selectedResults);
      setSelectedSearchPaths(new Set());
      refreshPanel(activePanelId);
    } catch (error) {
      console.error(error);
      setSearchError(getErrorMessage(error, "Failed to delete selected search results."));
    } finally {
      setIsDeletingSearchResults(false);
    }
  };

  const handleSearchOperation = async () => {
    if (!searchOperation) {
      return;
    }

    const selectedResults = getCollapsedSearchResults(getSelectedSearchResults());
    const trimmedTarget = searchOperationTarget.trim();
    if (selectedResults.length === 0 || !trimmedTarget) {
      return;
    }

    const resolvedTarget = isAbsolutePath(trimmedTarget)
      ? trimmedTarget
      : joinPath(targetPanel.currentPath, trimmedTarget);

    try {
      setIsApplyingSearchOperation(true);
      setSearchOperationError(null);

      if (searchOperation === "copy") {
        await fs.copyFiles(
          selectedResults.map((result) => result.path),
          resolvedTarget
        );
      } else {
        await fs.moveFiles(
          selectedResults.map((result) => result.path),
          resolvedTarget
        );
        removeResultsFromList(selectedResults);
        setSelectedSearchPaths(new Set());
      }

      refreshPanel(activePanelId);
      refreshPanel(activePanelId === "left" ? "right" : "left");
      closeSearchOperationDialog();
    } catch (error) {
      console.error(error);
      setSearchOperationError(
        getErrorMessage(
          error,
          searchOperation === "copy"
            ? "Failed to copy selected search results."
            : "Failed to move selected search results."
        )
      );
    } finally {
      setIsApplyingSearchOperation(false);
    }
  };

  return (
    <>
      {/* Search Dialog */}
      <Dialog.Root open={openDialog === "search"} onOpenChange={(open) => !open && closeDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[600px] h-[400px] z-50 p-4 flex flex-col focus:outline-none text-text-primary">
            <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-2">
              Search in {activePanel.currentPath}
            </Dialog.Title>
            <div className="flex gap-2 mb-4">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Find files..."
                className="flex-1 bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color"
                autoFocus
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>

            <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
              <span>{selectedSearchPaths.size} selected</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllSearchResults}
                  disabled={searchResults.length === 0}
                  className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearSearchSelection}
                  disabled={selectedSearchPaths.size === 0}
                  className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear Selection
                </button>
                <button
                  onClick={() => openSearchOperationDialog("copy")}
                  disabled={selectedSearchPaths.size === 0}
                  className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Copy Selected
                </button>
                <button
                  onClick={() => openSearchOperationDialog("move")}
                  disabled={selectedSearchPaths.size === 0}
                  className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Move Selected
                </button>
                <button
                  onClick={handleDeleteSearchResults}
                  disabled={selectedSearchPaths.size === 0 || isDeletingSearchResults}
                  className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeletingSearchResults ? "Deleting..." : "Delete Selected"}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-bg-primary border border-border-color rounded text-sm custom-scrollbar p-1">
              {searchError ? (
                <p className="p-2 text-red-400 text-center text-xs">{searchError}</p>
              ) : null}
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleSearchResultSelection(res.path)}
                  className={`flex w-full items-center gap-2 p-1 text-left hover:bg-bg-hover cursor-pointer truncate ${
                    selectedSearchPaths.has(res.path) ? "bg-bg-selected/40" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSearchPaths.has(res.path)}
                    onChange={() => toggleSearchResultSelection(res.path)}
                    onClick={(event) => event.stopPropagation()}
                    className="h-3.5 w-3.5 shrink-0 accent-current"
                  />
                  <span className="shrink-0 text-text-secondary">
                    {res.is_dir ? <Folder size={14} className="text-accent-color/80" /> : <File size={14} />}
                  </span>
                  <span className="truncate">{res.path}</span>
                </button>
              ))}
              {!isSearching && searchResults.length === 0 && searchQuery && !searchError && (
                <p className="p-2 text-text-secondary text-center text-xs">No files found or start typing...</p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={closeDialog}
                className="px-4 py-1.5 text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color"
              >
                Close
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={searchOperation !== null}
        onOpenChange={(open) => !open && closeSearchOperationDialog()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[460px] z-50 p-4 focus:outline-none text-text-primary">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSearchOperation();
              }}
            >
              <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
                {searchOperation === "copy" ? "Copy" : "Move"} {selectedSearchPaths.size} search result(s)
              </Dialog.Title>
              <div className="mb-4 space-y-3">
                <p className="text-xs text-text-secondary">
                  Target path:
                </p>
                <input
                  autoFocus
                  value={searchOperationTarget}
                  onChange={(event) => {
                    setSearchOperationTarget(event.target.value);
                    if (searchOperationError) {
                      setSearchOperationError(null);
                    }
                  }}
                  className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white"
                />
                {searchOperationError ? (
                  <p className="text-xs text-red-400">{searchOperationError}</p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeSearchOperationDialog}
                  disabled={isApplyingSearchOperation}
                  className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApplyingSearchOperation}
                  className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isApplyingSearchOperation
                    ? searchOperation === "copy"
                      ? "Copying..."
                      : "Moving..."
                    : searchOperation === "copy"
                      ? "Copy"
                      : "Move"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </>
  );
};
