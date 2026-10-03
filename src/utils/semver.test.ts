import { describe, expect, it } from "vitest";
import { compareSemver, isNewerVersion, parseSemver } from "./semver";

describe("semver utility", () => {
  it("parses valid semver strings with or without 'v' prefix", () => {
    expect(parseSemver("1.2.25")).toEqual({
      major: 1,
      minor: 2,
      patch: 25,
      prerelease: undefined,
    });
    expect(parseSemver("v1.2.26")).toEqual({
      major: 1,
      minor: 2,
      patch: 26,
      prerelease: undefined,
    });
    expect(parseSemver("V2.0.0-beta.1")).toEqual({
      major: 2,
      minor: 0,
      patch: 0,
      prerelease: "beta.1",
    });
  });

  it("returns null for invalid semver strings", () => {
    expect(parseSemver("invalid")).toBeNull();
    expect(parseSemver("1.2")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });

  it("correctly compares version numbers", () => {
    expect(compareSemver("1.2.25", "1.2.24")).toBe(1);
    expect(compareSemver("1.2.25", "1.2.25")).toBe(0);
    expect(compareSemver("v1.2.25", "1.2.26")).toBe(-1);
    expect(compareSemver("2.0.0", "1.9.99")).toBe(1);
    expect(compareSemver("1.3.0", "1.2.99")).toBe(1);
  });

  it("determines if a remote version is strictly newer", () => {
    expect(isNewerVersion("1.2.25", "v1.2.26")).toBe(true);
    expect(isNewerVersion("1.2.25", "1.3.0")).toBe(true);
    expect(isNewerVersion("1.2.25", "2.0.0")).toBe(true);
    expect(isNewerVersion("1.2.25", "v1.2.25")).toBe(false);
    expect(isNewerVersion("1.2.25", "1.2.24")).toBe(false);
  });
});
