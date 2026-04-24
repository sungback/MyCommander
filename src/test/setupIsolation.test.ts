import { describe, expect, it, vi } from "vitest";

describe("test setup isolation", () => {
  it("can enable fake timers in one test", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2000-01-01T00:00:00.000Z"));

    expect(new Date().getUTCFullYear()).toBe(2000);
  });

  it("restores real timers before the next test", () => {
    expect(new Date().getUTCFullYear()).not.toBe(2000);
  });
});
