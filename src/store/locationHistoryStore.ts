import { create } from "zustand";
import { normalizePathForComparison } from "../utils/path";
import { getPathDisplayName } from "../utils/pathDisplay";

export interface LocationHistoryEntry {
  path: string;
  name: string;
  lastVisited: number;
  visitCount: number;
}

interface LocationHistoryState {
  locations: LocationHistoryEntry[];
  recordLocation: (path: string, name?: string) => void;
  removeLocation: (path: string) => void;
  clearLocations: () => void;
}

const LOCATION_HISTORY_STORAGE_KEY = "total-commander:location-history";
const MAX_LOCATION_HISTORY_ENTRIES = 50;

const getLocationName = (path: string) => getPathDisplayName(path);

const isLocationHistoryEntry = (value: unknown): value is LocationHistoryEntry => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const path = Reflect.get(value, "path");
  const name = Reflect.get(value, "name");
  const lastVisited = Reflect.get(value, "lastVisited");
  const visitCount = Reflect.get(value, "visitCount");

  return (
    typeof path === "string" &&
    path.length > 0 &&
    typeof name === "string" &&
    name.length > 0 &&
    typeof lastVisited === "number" &&
    Number.isFinite(lastVisited) &&
    typeof visitCount === "number" &&
    Number.isFinite(visitCount)
  );
};

const readLocations = (): LocationHistoryEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCATION_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isLocationHistoryEntry)
      .sort((left, right) => right.lastVisited - left.lastVisited)
      .slice(0, MAX_LOCATION_HISTORY_ENTRIES);
  } catch {
    return [];
  }
};

const writeLocations = (locations: LocationHistoryEntry[]) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LOCATION_HISTORY_STORAGE_KEY,
      JSON.stringify(locations)
    );
  } catch {
    // Ignore storage errors.
  }
};

const normalizeLocationPath = (path: string) =>
  normalizePathForComparison(path.trim());

const sortByLastVisited = (locations: LocationHistoryEntry[]) =>
  [...locations].sort((left, right) => right.lastVisited - left.lastVisited);

export const getRecentLocations = (
  locations: LocationHistoryEntry[],
  limit = 8
) => sortByLastVisited(locations).slice(0, limit);

export const getFrequentLocations = (
  locations: LocationHistoryEntry[],
  limit = 5
) =>
  [...locations]
    .filter((entry) => entry.visitCount > 1)
    .sort(
      (left, right) =>
        right.visitCount - left.visitCount || right.lastVisited - left.lastVisited
    )
    .slice(0, limit);

export const useLocationHistoryStore = create<LocationHistoryState>((set) => ({
  locations: readLocations(),

  recordLocation: (path, name) =>
    set((state) => {
      const trimmedPath = path.trim();
      if (!trimmedPath) {
        return state;
      }

      const normalizedPath = normalizeLocationPath(trimmedPath);
      const now = Date.now();
      const nextEntryName = name?.trim() || getLocationName(trimmedPath);
      const existing = state.locations.find(
        (entry) => normalizeLocationPath(entry.path) === normalizedPath
      );

      const next = sortByLastVisited([
        {
          path: trimmedPath,
          name: nextEntryName,
          lastVisited: now,
          visitCount: (existing?.visitCount ?? 0) + 1,
        },
        ...state.locations.filter(
          (entry) => normalizeLocationPath(entry.path) !== normalizedPath
        ),
      ]).slice(0, MAX_LOCATION_HISTORY_ENTRIES);

      writeLocations(next);
      return { locations: next };
    }),

  removeLocation: (path) =>
    set((state) => {
      const normalizedPath = normalizeLocationPath(path);
      const next = state.locations.filter(
        (entry) => normalizeLocationPath(entry.path) !== normalizedPath
      );

      if (next.length === state.locations.length) {
        return state;
      }

      writeLocations(next);
      return { locations: next };
    }),

  clearLocations: () =>
    set(() => {
      writeLocations([]);
      return { locations: [] };
    }),
}));
