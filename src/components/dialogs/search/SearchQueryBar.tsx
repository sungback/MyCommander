interface SearchQueryBarProps {
  query: string;
  showAdvancedOptions: boolean;
  isSearching: boolean;
  onQueryChange: (query: string) => void;
  onToggleAdvancedOptions: () => void;
  onSearch: () => void;
}

export const SearchQueryBar = ({
  query,
  showAdvancedOptions,
  isSearching,
  onQueryChange,
  onToggleAdvancedOptions,
  onSearch,
}: SearchQueryBarProps) => (
  <div className="flex gap-2 mb-3">
    <input
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onSearch();
        }
      }}
      placeholder="Find files..."
      className="flex-1 bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color"
      autoFocus
    />
    <button
      type="button"
      onClick={onToggleAdvancedOptions}
      className="px-3 py-1.5 text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color"
      aria-expanded={showAdvancedOptions}
    >
      Advanced
    </button>
    <button
      type="button"
      onClick={onSearch}
      disabled={isSearching}
      className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSearching ? "Searching..." : "Search"}
    </button>
  </div>
);
