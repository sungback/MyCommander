import { describe, expect, it } from "vitest";
import type { JobRecord } from "../../types/job";
import {
  formatProgress,
  shouldShowJobSection,
  sortJobs,
  titleForKind,
} from "./jobCenterHelpers";

const createJob = (id: string, createdAt: number): JobRecord => ({
  id,
  kind: "copy",
  status: "queued",
  createdAt,
  updatedAt: createdAt,
  progress: { current: 1, total: 2, currentFile: "file.txt", unit: "items" },
  error: null,
  result: null,
});

describe("jobCenterHelpers", () => {
  it("formats progress for item and byte jobs", () => {
    expect(formatProgress(createJob("items", 1))).toBe("1 / 2");
    expect(
      formatProgress({
        ...createJob("bytes", 1),
        progress: {
          current: 1024,
          total: 2048,
          currentFile: "file.bin",
          unit: "bytes",
        },
      })
    ).toBe("1.0 KB / 2.0 KB");
    expect(
      formatProgress({
        ...createJob("pending", 1),
        progress: { current: 0, total: 0, currentFile: "", unit: "items" },
      })
    ).toBe("Preparing...");
  });

  it("formats job kind titles", () => {
    expect(titleForKind("copy")).toBe("Copy");
    expect(titleForKind("zip")).toBe("Zip");
  });

  it("sorts jobs by selected order", () => {
    const jobs = [createJob("older", 1), createJob("newer", 2)];

    expect(sortJobs(jobs, "newest").map((job) => job.id)).toEqual([
      "newer",
      "older",
    ]);
    expect(sortJobs(jobs, "oldest").map((job) => job.id)).toEqual([
      "older",
      "newer",
    ]);
  });

  it("shows matching sections for all or specific filters", () => {
    expect(shouldShowJobSection("all", "failed")).toBe(true);
    expect(shouldShowJobSection("failed", "failed")).toBe(true);
    expect(shouldShowJobSection("failed", "running")).toBe(false);
  });
});
