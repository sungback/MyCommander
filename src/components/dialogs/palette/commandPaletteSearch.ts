import type { CommandPaletteItem } from "./commandPaletteActions";

const normalizeSearchText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim();

const getSearchHaystack = (item: CommandPaletteItem) =>
  normalizeSearchText(
    [item.title, item.subtitle, item.shortcut, ...item.keywords].filter(Boolean).join(" ")
  );

const getMatchScore = (item: CommandPaletteItem, query: string): number | null => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const title = normalizeSearchText(item.title);
  const haystack = getSearchHaystack(item);
  if (!tokens.every((token) => haystack.includes(token))) {
    return null;
  }

  if (title.startsWith(normalizedQuery)) {
    return 0;
  }

  if (title.includes(normalizedQuery)) {
    return 1;
  }

  return 2;
};

export const filterCommandPaletteItems = (
  items: CommandPaletteItem[],
  query: string
) =>
  items
    .map((item, index) => ({ item, index, score: getMatchScore(item, query) }))
    .filter((entry): entry is { item: CommandPaletteItem; index: number; score: number } =>
      entry.score !== null
    )
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((entry) => entry.item);

export const moveCommandPaletteSelection = (
  currentIndex: number,
  delta: number,
  itemCount: number
) => {
  if (itemCount <= 0) {
    return 0;
  }

  return (currentIndex + delta + itemCount) % itemCount;
};
