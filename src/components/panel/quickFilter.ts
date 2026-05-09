import type { FileEntry } from "../../types/file";

export const normalizeQuickFilterQuery = (query: string) =>
  query.normalize("NFC").trim().toLocaleLowerCase();

const getQuickFilterTerms = (normalizedQuery: string) =>
  normalizedQuery.split(/\s+/).filter(Boolean);

export const entryMatchesQuickFilter = (
  entry: FileEntry,
  normalizedQuery: string
) => {
  if (!normalizedQuery) {
    return true;
  }

  if (entry.name === "..") {
    return false;
  }

  const normalizedName = entry.name.normalize("NFC").toLocaleLowerCase();
  return getQuickFilterTerms(normalizedQuery).every((term) =>
    normalizedName.includes(term)
  );
};

export const filterEntriesByQuickFilter = (
  entries: FileEntry[],
  query: string
) => {
  const normalizedQuery = normalizeQuickFilterQuery(query);
  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter((entry) =>
    entryMatchesQuickFilter(entry, normalizedQuery)
  );
};
