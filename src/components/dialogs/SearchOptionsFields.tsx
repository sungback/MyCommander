import type { SearchOptions } from "../../types/search";
import {
  formatDateInput,
  formatExtensionsInput,
  parseDateEndMs,
  parseDateStartMs,
  parseExtensionsInput,
  parseOptionalNumberInput,
} from "./searchOptions";

export type SearchOptionChange = <K extends keyof SearchOptions>(
  key: K,
  value: SearchOptions[K]
) => void;

interface SearchOptionsFieldsProps {
  searchOptions: SearchOptions;
  onChange: SearchOptionChange;
}

export const SearchOptionsFields = ({
  searchOptions,
  onChange,
}: SearchOptionsFieldsProps) => (
  <div className="mb-3 rounded border border-border-color bg-bg-secondary/30 p-3 text-xs">
    <div className="grid grid-cols-2 gap-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={searchOptions.useRegex}
          onChange={(event) => onChange("useRegex", event.target.checked)}
        />
        <span>Use regex</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={searchOptions.caseSensitive}
          onChange={(event) => onChange("caseSensitive", event.target.checked)}
        />
        <span>Case sensitive</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={searchOptions.includeHidden}
          onChange={(event) => onChange("includeHidden", event.target.checked)}
        />
        <span>Include hidden files</span>
      </label>
      <label className="flex flex-col gap-1">
        <span>Entry kind</span>
        <select
          aria-label="Entry kind"
          value={searchOptions.entryKind}
          onChange={(event) =>
            onChange("entryKind", event.target.value as SearchOptions["entryKind"])
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
            onChange("scope", event.target.value as SearchOptions["scope"])
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
            onChange("extensions", parseExtensionsInput(event.target.value))
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
            onChange("minSizeBytes", parseOptionalNumberInput(event.target.value))
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
            onChange("maxSizeBytes", parseOptionalNumberInput(event.target.value))
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
            onChange("modifiedAfterMs", parseDateStartMs(event.target.value))
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
            onChange("modifiedBeforeMs", parseDateEndMs(event.target.value))
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
            onChange(
              "maxResults",
              parseOptionalNumberInput(event.target.value) ?? 1
            )
          }
          className="bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm"
        />
      </label>
    </div>
  </div>
);
