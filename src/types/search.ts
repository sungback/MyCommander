export type SearchScope = "name" | "path";
export type SearchEntryKind = "all" | "files" | "directories";

export const DEFAULT_SEARCH_MAX_RESULTS = 5000;

export interface SearchOptions {
  query: string;
  useRegex: boolean;
  caseSensitive: boolean;
  includeHidden: boolean;
  scope: SearchScope;
  entryKind: SearchEntryKind;
  extensions: string[];
  minSizeBytes: number | null;
  maxSizeBytes: number | null;
  modifiedAfterMs: number | null;
  modifiedBeforeMs: number | null;
  maxResults: number;
}
