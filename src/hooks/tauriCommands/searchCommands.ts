import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_SEARCH_MAX_RESULTS,
  SearchOptions,
} from "../../types/search";

export interface SearchResult {
  name: string;
  path: string;
  size?: number;
  is_dir: boolean;
}

export type SearchEvent =
  | { type: "ResultBatch"; payload: SearchResult[] }
  | { type: "Progress"; payload: { current_dir: string } }
  | { type: "Finished"; payload: { total_matches: number } };

type SearchHandler = (event: SearchEvent) => void;

export const searchCommands = {
  searchFiles: async (
    startPath: string,
    queryOrOptions: string | SearchOptions,
    useRegexOrOnEvent: boolean | SearchHandler,
    maybeOnEvent?: SearchHandler
  ): Promise<void> => {
    const { Channel } = await import("@tauri-apps/api/core");
    const channel = new Channel<SearchEvent>();
    const options =
      typeof queryOrOptions === "string"
        ? {
            query: queryOrOptions,
            useRegex: useRegexOrOnEvent as boolean,
            caseSensitive: true,
            includeHidden: true,
            scope: "name" as const,
            entryKind: "all" as const,
            extensions: [],
            minSizeBytes: null,
            maxSizeBytes: null,
            modifiedAfterMs: null,
            modifiedBeforeMs: null,
            maxResults: DEFAULT_SEARCH_MAX_RESULTS,
          }
        : queryOrOptions;
    const onEvent =
      typeof queryOrOptions === "string"
        ? maybeOnEvent
        : (useRegexOrOnEvent as SearchHandler);

    channel.onmessage = onEvent ?? (() => {});

    await invoke("search_files", {
      start_path: startPath,
      query: options.query,
      use_regex: options.useRegex,
      case_sensitive: options.caseSensitive,
      include_hidden: options.includeHidden,
      scope: options.scope,
      entry_kind: options.entryKind,
      extensions: options.extensions,
      min_size_bytes: options.minSizeBytes,
      max_size_bytes: options.maxSizeBytes,
      modified_after_ms: options.modifiedAfterMs,
      modified_before_ms: options.modifiedBeforeMs,
      max_results: options.maxResults,
      on_event: channel,
    });
  },
};
