import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFrequentLocations,
  getRecentLocations,
  useLocationHistoryStore,
} from "./locationHistoryStore";

const STORAGE_KEY = "total-commander:location-history";

describe("locationHistoryStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useLocationHistoryStore.setState({ locations: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records locations with a display name and persists them", () => {
    vi.setSystemTime(new Date("2026-05-09T00:00:00Z"));
    useLocationHistoryStore.getState().recordLocation("/home/user/Documents");

    const locations = useLocationHistoryStore.getState().locations;
    expect(locations).toEqual([
      expect.objectContaining({
        name: "Documents",
        path: "/home/user/Documents",
        visitCount: 1,
      }),
    ]);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored[0].path).toBe("/home/user/Documents");
  });

  it("deduplicates equivalent paths and increments visit count", () => {
    vi.setSystemTime(new Date("2026-05-09T00:00:00Z"));
    useLocationHistoryStore.getState().recordLocation("/home/user/Documents");
    vi.setSystemTime(new Date("2026-05-09T00:01:00Z"));
    useLocationHistoryStore.getState().recordLocation("/home/user/Documents/");

    const locations = useLocationHistoryStore.getState().locations;
    expect(locations).toHaveLength(1);
    expect(locations[0]).toEqual(
      expect.objectContaining({
        path: "/home/user/Documents/",
        visitCount: 2,
      })
    );
  });

  it("returns recent and frequent locations in the expected order", () => {
    vi.setSystemTime(new Date("2026-05-09T00:00:00Z"));
    useLocationHistoryStore.getState().recordLocation("/a");
    vi.setSystemTime(new Date("2026-05-09T00:01:00Z"));
    useLocationHistoryStore.getState().recordLocation("/b");
    vi.setSystemTime(new Date("2026-05-09T00:02:00Z"));
    useLocationHistoryStore.getState().recordLocation("/a");

    const locations = useLocationHistoryStore.getState().locations;
    expect(getRecentLocations(locations, 2).map((entry) => entry.path)).toEqual([
      "/a",
      "/b",
    ]);
    expect(getFrequentLocations(locations, 2).map((entry) => entry.path)).toEqual([
      "/a",
    ]);
  });

  it("removes equivalent paths", () => {
    useLocationHistoryStore.getState().recordLocation("/home/user/Documents");
    useLocationHistoryStore.getState().removeLocation("/home/user/Documents/");

    expect(useLocationHistoryStore.getState().locations).toEqual([]);
  });
});
