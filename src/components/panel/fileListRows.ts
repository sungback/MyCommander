import type {
  DirectorySizeStatus,
  FileEntry,
  SortDirection,
  SortField,
} from "../../types/file";
import { sortEntries } from "../../utils/panelHelpers";

export interface VisibleEntryRow {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  canExpand: boolean;
}

interface GetVisibleRowsArgs {
  entries: FileEntry[];
  expandedPaths: Set<string>;
  childEntriesByPath: Record<string, FileEntry[]>;
  sizeCache: Record<string, number>;
  sizeStatusCache?: Record<string, DirectorySizeStatus>;
  sortField: SortField;
  sortDirection: SortDirection;
  depth?: number;
}

export const isSelectableEntry = (entry: FileEntry) => entry.name !== "..";

const applyCachedSize = (
  entry: FileEntry,
  sizeCache: Record<string, number>,
  sizeStatusCache: Record<string, DirectorySizeStatus> = {}
) => {
  const normalizedPath = entry.path.normalize("NFC");
  const cachedSize = sizeCache[normalizedPath];
  const cachedStatus = sizeStatusCache[normalizedPath];

  if (cachedSize === undefined && cachedStatus === undefined) {
    return entry;
  }

  return {
    ...entry,
    ...(cachedSize === undefined ? {} : { size: cachedSize }),
    ...(cachedStatus === undefined
      ? cachedSize === undefined
        ? {}
        : { sizeStatus: "exact" as const }
      : { sizeStatus: cachedStatus }),
  };
};

export const getVisibleRows = ({
  entries,
  expandedPaths,
  childEntriesByPath,
  sizeCache,
  sizeStatusCache = {},
  sortField,
  sortDirection,
  depth = 0,
}: GetVisibleRowsArgs): VisibleEntryRow[] => {
  const rows: VisibleEntryRow[] = [];

  for (const entry of entries) {
    const canExpand = entry.kind === "directory" && entry.name !== "..";
    const isExpanded = canExpand && expandedPaths.has(entry.path);
    const resolvedEntry = applyCachedSize(entry, sizeCache, sizeStatusCache);

    rows.push({ entry: resolvedEntry, depth, canExpand, isExpanded });

    if (!isExpanded) continue;

    const children = childEntriesByPath[entry.path] ?? [];
    const resolvedChildren = children.map((child) =>
      applyCachedSize(child, sizeCache, sizeStatusCache)
    );
    const sortedChildren = sortEntries(
      resolvedChildren.filter(isSelectableEntry),
      sortField,
      sortDirection
    );

    rows.push(
      ...getVisibleRows({
        entries: sortedChildren,
        expandedPaths,
        childEntriesByPath,
        sizeCache,
        sizeStatusCache,
        sortField,
        sortDirection,
        depth: depth + 1,
      })
    );
  }

  return rows;
};
