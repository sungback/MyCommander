import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Resizable } from "re-resizable";
import { File, Folder } from "lucide-react";
import { useDialogStore } from "../../store/dialogStore";
import { getErrorMessage, SearchResult, useFileSystem } from "../../hooks/useFileSystem";
import { usePanelStore } from "../../store/panelStore";
import {
  coalescePanelPath,
  getPathDirectoryName,
  isAbsolutePath,
  joinPath,
} from "../../utils/path";
import {
  refreshPanelsForDirectories,
  refreshPanelsForEntryPaths,
} from "../../store/panelRefresh";
import { PanelState } from "../../types/file";
import {
  createDefaultSearchOptions,
  formatDateInput,
  formatExtensionsInput,
  parseDateEndMs,
  parseDateStartMs,
  parseExtensionsInput,
  parseOptionalNumberInput,
} from "./searchOptions";

const SEARCH_DIALOG_SIZE_KEY = "mycommander:search-dialog-size";
const DEFAULT_DIALOG_SIZE = { width: 700, height: 560 };

const getPanelAccessPath = (panel: PanelState) =>
  coalescePanelPath(panel.resolvedPath, panel.currentPath);

export const SearchPreviewDialogs: React.FC = () => {
  const { openDialog, closeDialog } = useDialogStore();
  const fs = useFileSystem();

  const activePanelId = usePanelStore((state) => state.activePanel);
  const leftPanel = usePanelStore((state) => state.leftPanel);
  const rightPanel = usePanelStore((state) => state.rightPanel);
  const activePanel = activePanelId === "left" ? leftPanel : rightPanel;
  const targetPanel = activePanelId === "left" ? rightPanel : leftPanel;

  const [searchOptions, setSearchOptions] = useState(createDefaultSearchOptions);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedSearchPaths, setSelectedSearchPaths] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState("");
  const [isDeletingSearchResults, setIsDeletingSearchResults] = useState(false);
  const [searchOperation, setSearchOperation] = useState<"copy" | "move" | null>(null);
  const [searchOperationTarget, setSearchOperationTarget] = useState("");
  const [isApplyingSearchOperation, setIsApplyingSearchOperation] = useState(false);
  const [searchOperationError, setSearchOperationError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dialogSize, setDialogSize] = useState<{ width: number; height: number }>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_DIALOG_SIZE_KEY);
      if (saved) return JSON.parse(saved) as { width: number; height: number };
    } catch {
      // ignore storage parse failure
    }
    return DEFAULT_DIALOG_SIZE;
  });

  useEffect(() => {
    if (openDialog !== "search") {
      setSearchOptions(createDefaultSearchOptions());
      setShowAdvancedOptions(false);
      setSearchError(null);
      setSearchResults([]);
      setSelectedSearchPaths(new Set());
      setSearchOperation(null);
      setSearchOperationTarget("");
      setSearchOperationError(null);
      setSearchProgress("");
    }
  }, [openDialog]);

  const handleSearch = async () => {
    const query = searchOptions.query.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchResults([]);
    setSelectedSearchPaths(new Set());
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
      refreshPanelsForEntryPaths(selectedResults.map((result) => result.path));
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

    const directTarget =
      trimmedTarget.normalize("NFC") === targetPanel.currentPath.normalize("NFC")
        ? getPanelAccessPath(targetPanel)
        : trimmedTarget;
    const resolvedTarget = isAbsolutePath(directTarget)
      ? directTarget
      : joinPath(getPanelAccessPath(targetPanel), directTarget);

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

      refreshPanelsForDirectories([
        resolvedTarget,
        ...selectedResults.map((result) => getPathDirectoryName(result.path)),
      ]);
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

  const updateSearchOption = <K extends keyof typeof searchOptions>(
    key: K,
    value: (typeof searchOptions)[K]
  ) => {
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
                  localStorage.setItem(SEARCH_DIALOG_SIZE_KEY, JSON.stringify(newSize));
                } catch {
                  // ignore storage failure
                }
              }}
              handleComponent={{
                bottomRight: (
                  <div className="absolute bottom-1 right-1 w-3 h-3 opacity-40 hover:opacity-90 transition-opacity">
                    <svg viewBox="0 0 8 8" fill="currentColor" className="text-text-secondary w-full h-full">
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
                    onChange={(event) => updateSearchOption("query", event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
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
                  <div className="mb-3 rounded border border-border-color bg-bg-secondary/30 p-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={searchOptions.useRegex}
                          onChange={(event) => updateSearchOption("useRegex", event.target.checked)}
                        />
                        <span>Use regex</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={searchOptions.caseSensitive}
                          onChange={(event) =>
                            updateSearchOption("caseSensitive", event.target.checked)
                          }
                        />
                        <span>Case sensitive</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={searchOptions.includeHidden}
                          onChange={(event) =>
                            updateSearchOption("includeHidden", event.target.checked)
                          }
                        />
                        <span>Include hidden files</span>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>Entry kind</span>
                        <select
                          aria-label="Entry kind"
                          value={searchOptions.entryKind}
                          onChange={(event) =>
                            updateSearchOption(
                              "entryKind",
                              event.target.value as typeof searchOptions.entryKind
                            )
                          }
                          className="bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm"
                        >
                          <option value="all">All</option>
                          <option value="files">Files only</option>
                          <option value="directories">Directories only</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>Scope</span>
                        <select
                          aria-label="Scope"
                          value={searchOptions.scope}
                          onChange={(event) =>
                            updateSearchOption(
                              "scope",
                              event.target.value as typeof searchOptions.scope
                            )
                          }
                          className="bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm"
                        >
                          <option value="name">File name</option>
                          <option value="path">Full path</option>
                        </select>
                      </label>
                      <label className="col-span-2 flex flex-col gap-1">
                        <span>Extensions</span>
                        <input
                          aria-label="Extensions"
                          value={formatExtensionsInput(searchOptions.extensions)}
                          onChange={(event) =>
                            updateSearchOption(
                              "extensions",
                              parseExtensionsInput(event.target.value)
                            )
                          }
                          placeholder=".txt, md, rs"
                          className="bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>Min size (bytes)</span>
                        <input
                          aria-label="Min size (bytes)"
                          type="number"
                          min="0"
                          value={searchOptions.minSizeBytes ?? ""}
                          onChange={(event) =>
                            updateSearchOption(
                              "minSizeBytes",
                              parseOptionalNumberInput(event.target.value)
                            )
                          }
                          className="bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>Max size (bytes)</span>
                        <input
                          aria-label="Max size (bytes)"
                          type="number"
                          min="0"
                          value={searchOptions.maxSizeBytes ?? ""}
                          onChange={(event) =>
                            updateSearchOption(
                              "maxSizeBytes",
                              parseOptionalNumberInput(event.target.value)
                            )
                          }
                          className="bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>Modified after</span>
                        <input
                          aria-label="Modified after"
                          type="date"
                          value={formatDateInput(searchOptions.modifiedAfterMs)}
                          onChange={(event) =>
                            updateSearchOption(
                              "modifiedAfterMs",
                              parseDateStartMs(event.target.value)
                            )
                          }
                          className="bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>Modified before</span>
                        <input
                          aria-label="Modified before"
                          type="date"
                          value={formatDateInput(searchOptions.modifiedBeforeMs)}
                          onChange={(event) =>
                            updateSearchOption(
                              "modifiedBeforeMs",
                              parseDateEndMs(event.target.value)
                            )
                          }
                          className="bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>Max results</span>
                        <input
                          aria-label="Max results"
                          type="number"
                          min="1"
                          value={searchOptions.maxResults}
                          onChange={(event) =>
                            updateSearchOption(
                              "maxResults",
                              parseOptionalNumberInput(event.target.value) ?? 1
                            )
                          }
                          className="bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {isSearching && searchProgress ? (
                  <div className="text-[11px] text-text-secondary truncate mb-2 px-1">
                    Scanning: {searchProgress}
                  </div>
                ) : null}

                <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
                  <span>
                    {selectedSearchPaths.size} selected / {searchResults.length} results
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllSearchResults}
                      disabled={searchResults.length === 0}
                      className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSearchSelection}
                      disabled={selectedSearchPaths.size === 0}
                      className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={() => openSearchOperationDialog("copy")}
                      disabled={selectedSearchPaths.size === 0}
                      className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Copy Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => openSearchOperationDialog("move")}
                      disabled={selectedSearchPaths.size === 0}
                      className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Move Selected
                    </button>
                    <button
                      type="button"
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
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.path}:${index}`}
                      type="button"
                      onClick={() => toggleSearchResultSelection(result.path)}
                      className={`flex w-full items-center gap-2 p-1 text-left hover:bg-bg-hover cursor-pointer truncate ${
                        selectedSearchPaths.has(result.path) ? "bg-bg-selected/40" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSearchPaths.has(result.path)}
                        onChange={() => toggleSearchResultSelection(result.path)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-3.5 w-3.5 shrink-0 accent-current"
                      />
                      <span className="shrink-0 text-text-secondary">
                        {result.is_dir ? (
                          <Folder size={14} className="text-accent-color/80" />
                        ) : (
                          <File size={14} />
                        )}
                      </span>
                      <span className="truncate">{result.path}</span>
                    </button>
                  ))}
                  {!isSearching &&
                  searchResults.length === 0 &&
                  searchOptions.query &&
                  !searchError ? (
                    <p className="p-2 text-text-secondary text-center text-xs">
                      No files found or start typing...
                    </p>
                  ) : null}
                </div>

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
                <p className="text-xs text-text-secondary">Target path:</p>
                <input
                  autoFocus
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
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
