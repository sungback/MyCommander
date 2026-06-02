import { describe, expect, it } from "vitest";
import type { FileEntry } from "../../../types/file";
import {
  getAutomaticEstimateOptions,
  isLikelyCloudStoragePath,
  isLikelyVolatileAutoScanPath,
  isLikelyHeavySystemPath,
  shouldAutoScanExactSizes,
  shouldQueueExactBackgroundScan,
  getExactAttemptKey,
  createScheduler,
} from "./backgroundDirSizeHelpers";

const makeDirectory = (path: string): FileEntry => ({
  name: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
  path,
  kind: "directory",
});

describe("backgroundDirSizeHelpers", () => {
  it("createScheduler initializes scheduler state correctly", () => {
    const scheduler = createScheduler();
    expect(scheduler.activeCount).toBe(0);
    expect(scheduler.queue).toEqual([]);
    expect(scheduler.queuedPaths.size).toBe(0);
    expect(scheduler.settledPaths.size).toBe(0);
    expect(scheduler.activeExactCount).toBe(0);
    expect(scheduler.exactQueue).toEqual([]);
    expect(scheduler.queuedExactPaths.size).toBe(0);
    expect(scheduler.settledExactPaths.size).toBe(0);
    expect(scheduler.activeExactScans.size).toBe(0);
  });

  it("getExactAttemptKey generates consistent key", () => {
    const entry: FileEntry = {
      name: "Projects",
      path: "C:\\Users\\sam\\Projects",
      kind: "directory",
      size: 1024,
      sizeStatus: "estimated",
    };
    const keyFresh = getExactAttemptKey(entry, false);
    const keyStale = getExactAttemptKey(entry, true);

    expect(keyFresh).toBe("C:\\Users\\sam\\Projects|1024|estimated|fresh");
    expect(keyStale).toBe("C:\\Users\\sam\\Projects|1024|estimated|stale");
  });

  it("uses shallower estimates for filesystem roots and deeper estimates for complex directories", () => {
    expect(getAutomaticEstimateOptions("C:\\")).toEqual({
      maxDepth: 0,
      maxEntries: 100,
    });
    expect(getAutomaticEstimateOptions("/")).toEqual({
      maxDepth: 0,
      maxEntries: 100,
    });
    expect(getAutomaticEstimateOptions("/Users/sam")).toEqual({
      maxDepth: 1,
      maxEntries: 200,
    });
    expect(getAutomaticEstimateOptions("C:\\Users\\sam\\AppData")).toEqual({
      maxDepth: 3,
      maxEntries: 1500,
    });
    expect(getAutomaticEstimateOptions("G:\\내 드라이브")).toEqual({
      maxDepth: 3,
      maxEntries: 1500,
    });
    expect(shouldAutoScanExactSizes("C:\\")).toBe(false);
    expect(shouldAutoScanExactSizes("/Users/sam")).toBe(true);
  });

  it("does not automatically exact-scan likely cloud storage paths", () => {
    expect(isLikelyCloudStoragePath("G:\\내 드라이브")).toBe(true);
    expect(isLikelyCloudStoragePath("C:\\Users\\sam\\Google Drive")).toBe(true);
    expect(isLikelyCloudStoragePath("/Users/sam/Library/CloudStorage/Dropbox")).toBe(true);
    expect(isLikelyCloudStoragePath("C:\\Users\\sam\\Projects")).toBe(false);

    expect(shouldAutoScanExactSizes("G:\\내 드라이브")).toBe(false);
    expect(
      shouldQueueExactBackgroundScan(
        {
          ...makeDirectory("G:\\내 드라이브"),
          size: 1024,
          sizeStatus: "estimated",
        },
        false
      )
    ).toBe(false);
  });

  it("does not automatically exact-scan volatile Windows profile paths", () => {
    expect(isLikelyVolatileAutoScanPath("C:\\Users\\sam\\AppData")).toBe(true);
    expect(isLikelyVolatileAutoScanPath("C:/Users/sam/AppData/Local")).toBe(true);
    expect(isLikelyVolatileAutoScanPath("C:\\Users\\sam\\AppData\\Local")).toBe(true);
    expect(isLikelyVolatileAutoScanPath("/Users/sam/AppData/Local")).toBe(false);
    expect(isLikelyVolatileAutoScanPath("C:\\Users\\sam\\ApplicationData")).toBe(false);
    expect(shouldAutoScanExactSizes("C:\\Users\\sam\\AppData")).toBe(false);
    expect(
      shouldQueueExactBackgroundScan(
        {
          ...makeDirectory("C:\\Users\\sam\\AppData"),
          size: 1024,
          sizeStatus: "partial",
        },
        false
      )
    ).toBe(false);
  });

  it("promotes partial estimates to automatic exact scans for stable local directories", () => {
    expect(
      shouldQueueExactBackgroundScan(
        {
          ...makeDirectory("C:\\Users\\sam\\anaconda3"),
          size: 1024,
          sizeStatus: "partial",
        },
        true
      )
    ).toBe(true);
  });

  it("does not automatically exact-scan likely heavy system paths", () => {
    expect(isLikelyHeavySystemPath("C:\\Users")).toBe(true);
    expect(isLikelyHeavySystemPath("c:\\Windows\\")).toBe(true);
    expect(isLikelyHeavySystemPath("D:\\Program Files")).toBe(true);
    expect(isLikelyHeavySystemPath("C:\\Users\\sam")).toBe(false);
    expect(isLikelyHeavySystemPath("/system")).toBe(true);
    expect(isLikelyHeavySystemPath("/usr")).toBe(true);
    expect(isLikelyHeavySystemPath("\\\\?\\C:\\Users")).toBe(true);
    expect(isLikelyHeavySystemPath("\\\\?\\UNC\\server\\share\\Users")).toBe(true);

    expect(shouldAutoScanExactSizes("C:\\Users")).toBe(false);
    expect(shouldAutoScanExactSizes("\\\\?\\C:\\Users")).toBe(false);
    expect(
      shouldQueueExactBackgroundScan(
        {
          ...makeDirectory("C:\\Users"),
          size: 1024,
          sizeStatus: "estimated",
        },
        false
      )
    ).toBe(false);
  });
});
