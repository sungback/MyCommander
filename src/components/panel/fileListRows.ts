import type { FileEntry, SortDirection, SortField } from "../../types/file";
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
  sortField: SortField;
  sortDirection: SortDirection;
  depth?: number;
}

export const isSelectableEntry = (entry: FileEntry) => entry.name !== "..";

const applyCachedSize = (
  entry: FileEntry,
  sizeCache: Record<string, number>
) => {
  const cachedSize = sizeCache[entry.path.normalize("NFC")];
  return cachedSize !== undefined ? { ...entry, size: cachedSize } : entry;
};

export const getVisibleRows = ({
  entries,
  expandedPaths,
  childEntriesByPath,
  sizeCache,
  sortField,
  sortDirection,
  depth = 0,
}: GetVisibleRowsArgs): VisibleEntryRow[] => {
  const rows: VisibleEntryRow[] = [];

  for (const entry of entries) {
    const canExpand = entry.kind === "directory" && entry.name !== "..";
    const isExpanded = canExpand && expandedPaths.has(entry.path);
    const resolvedEntry = applyCachedSize(entry, sizeCache);

    rows.push({ entry: resolvedEntry, depth, canExpand, isExpanded });

    if (!isExpanded) continue;

    const children = childEntriesByPath[entry.path] ?? [];
    const resolvedChildren = children.map((child) =>
      applyCachedSize(child, sizeCache)
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
        sortField,
        sortDirection,
        depth: depth + 1,
      })
    );
  }

  return rows;
};
