import React from "react";
import { Search, X } from "lucide-react";
import { clsx } from "clsx";

interface QuickFilterBarProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isActive: boolean;
  query: string;
  resultCount: number;
  totalCount: number;
  onChange: (query: string) => void;
  onClear: () => void;
}

export const QuickFilterBar: React.FC<QuickFilterBarProps> = ({
  inputRef,
  isActive,
  query,
  resultCount,
  totalCount,
  onChange,
  onClear,
}) => {
  const hasQuery = query.trim().length > 0;

  return (
    <div
      className={clsx(
        "flex h-8 items-center gap-2 border-b px-2 text-sm transition-colors",
        isActive
          ? "border-accent-color/40 bg-bg-panel"
          : "border-border-color bg-bg-secondary"
      )}
    >
      <Search size={14} className="shrink-0 text-text-secondary" aria-hidden="true" />
      <input
        ref={inputRef}
        aria-label="현재 폴더 필터"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && hasQuery) {
            event.preventDefault();
            onClear();
          }
        }}
        className="h-6 min-w-0 flex-1 rounded border border-border-color bg-bg-primary px-2 text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-accent-color"
        placeholder="Filter"
        spellCheck={false}
      />
      <span
        className={clsx(
          "min-w-11 shrink-0 text-right text-xs tabular-nums",
          hasQuery ? "text-text-primary" : "text-text-secondary"
        )}
      >
        {hasQuery ? `${resultCount}/${totalCount}` : totalCount}
      </span>
      <button
        type="button"
        onClick={onClear}
        disabled={!hasQuery}
        className={clsx(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors",
          hasQuery
            ? "cursor-pointer text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            : "cursor-default text-text-secondary opacity-30"
        )}
        title="필터 지우기"
      >
        <X size={14} />
      </button>
    </div>
  );
};
