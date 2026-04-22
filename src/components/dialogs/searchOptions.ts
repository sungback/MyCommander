import {
  DEFAULT_SEARCH_MAX_RESULTS,
  SearchOptions,
} from "../../types/search";

export const createDefaultSearchOptions = (): SearchOptions => ({
  query: "",
  useRegex: false,
  caseSensitive: true,
  includeHidden: true,
  scope: "name",
  entryKind: "all",
  extensions: [],
  minSizeBytes: null,
  maxSizeBytes: null,
  modifiedAfterMs: null,
  modifiedBeforeMs: null,
  maxResults: DEFAULT_SEARCH_MAX_RESULTS,
});

export const parseExtensionsInput = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
    .filter((item) => item.length > 0);

export const formatExtensionsInput = (extensions: string[]) =>
  extensions.join(", ");

export const parseOptionalNumberInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const parseDateStartMs = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseDateEndMs = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatDateInput = (value: number | null) => {
  if (value === null) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};
