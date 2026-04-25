import { File, Folder } from "lucide-react";
import type { SearchResult } from "../../hooks/useFileSystem";

interface SearchResultsPanelProps {
  searchOptionsQuery: string;
  searchResults: SearchResult[];
  selectedSearchPaths: Set<string>;
  isSearching: boolean;
  isDeletingSearchResults: boolean;
  searchProgress: string;
  searchError: string | null;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onOpenOperation: (operation: "copy" | "move") => void;
  onDelete: () => void;
  onToggleSelection: (path: string) => void;
}

export const SearchResultsPanel = ({
  searchOptionsQuery,
  searchResults,
  selectedSearchPaths,
  isSearching,
  isDeletingSearchResults,
  searchProgress,
  searchError,
  onSelectAll,
  onClearSelection,
  onOpenOperation,
  onDelete,
  onToggleSelection,
}: SearchResultsPanelProps) => (
  <>
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
          onClick={onSelectAll}
          disabled={searchResults.length === 0}
          className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
        >
          Select All
        </button>
        <button
          type="button"
          onClick={onClearSelection}
          disabled={selectedSearchPaths.size === 0}
          className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
        >
          Clear Selection
        </button>
        <button
          type="button"
          onClick={() => onOpenOperation("copy")}
          disabled={selectedSearchPaths.size === 0}
          className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
        >
          Copy Selected
        </button>
        <button
          type="button"
          onClick={() => onOpenOperation("move")}
          disabled={selectedSearchPaths.size === 0}
          className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
        >
          Move Selected
        </button>
        <button
          type="button"
          onClick={onDelete}
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
          onClick={() => onToggleSelection(result.path)}
          className={`flex w-full items-center gap-2 p-1 text-left hover:bg-bg-hover cursor-pointer truncate ${
            selectedSearchPaths.has(result.path) ? "bg-bg-selected/40" : ""
          }`}
        >
          <input
            type="checkbox"
            checked={selectedSearchPaths.has(result.path)}
            onChange={() => onToggleSelection(result.path)}
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
      {!isSearching && searchResults.length === 0 && searchOptionsQuery && !searchError ? (
        <p className="p-2 text-text-secondary text-center text-xs">
          No files found or start typing...
        </p>
      ) : null}
    </div>
  </>
);
