import { describe, it, expect, vi, beforeEach } from "vitest";
import { jobCommands } from "./jobCommands";
import type { JobRecord } from "../../types/job";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

beforeEach(() => {
  mockInvoke.mockReset();
});

const makeJobRecord = (overrides: Partial<JobRecord> = {}): JobRecord => ({
  id: "job-1",
  kind: "copy",
  status: "queued",
  createdAt: 0,
  updatedAt: 0,
  progress: { current: 0, total: 1, currentFile: "", unit: "items" },
  ...overrides,
});

describe("jobCommands", () => {
  describe("listJobs", () => {
    it("calls invoke with correct command and returns result", async () => {
      const jobs = [makeJobRecord()];
      mockInvoke.mockResolvedValue(jobs);

      const result = await jobCommands.listJobs();

      expect(mockInvoke).toHaveBeenCalledWith("list_jobs");
      expect(result).toEqual(jobs);
    });
  });

  describe("cancelJob", () => {
    it("calls invoke with job_id and returns record", async () => {
      const record = makeJobRecord({ id: "job-abc", status: "cancelled" });
      mockInvoke.mockResolvedValue(record);

      const result = await jobCommands.cancelJob("job-abc");

      expect(mockInvoke).toHaveBeenCalledWith("cancel_job", { job_id: "job-abc" });
      expect(result).toEqual(record);
    });
  });

  describe("retryJob", () => {
    it("calls invoke with job_id and returns record", async () => {
      const record = makeJobRecord({ id: "job-abc", status: "queued" });
      mockInvoke.mockResolvedValue(record);

      const result = await jobCommands.retryJob("job-abc");

      expect(mockInvoke).toHaveBeenCalledWith("retry_job", { job_id: "job-abc" });
      expect(result).toEqual(record);
    });
  });

  describe("clearFinishedJobs", () => {
    it("calls invoke with correct command", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await jobCommands.clearFinishedJobs();

      expect(mockInvoke).toHaveBeenCalledWith("clear_finished_jobs");
    });
  });

  describe("submitJob", () => {
    it("submits copy job with snake_case fields", async () => {
      const record = makeJobRecord();
      mockInvoke.mockResolvedValue(record);

      await jobCommands.submitJob({
        kind: "copy",
        sourcePaths: ["/a/file.txt"],
        targetPath: "/b/file.txt",
        keepBoth: true,
        overwrite: false,
      });

      expect(mockInvoke).toHaveBeenCalledWith("submit_job", {
        job: {
          kind: "copy",
          source_paths: ["/a/file.txt"],
          target_path: "/b/file.txt",
          keep_both: true,
          overwrite: false,
        },
      });
    });

    it("submits move job with snake_case fields", async () => {
      const record = makeJobRecord({ kind: "move" });
      mockInvoke.mockResolvedValue(record);

      await jobCommands.submitJob({
        kind: "move",
        sourcePaths: ["/a/file.txt"],
        targetDir: "/b/",
        overwrite: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith("submit_job", {
        job: {
          kind: "move",
          source_paths: ["/a/file.txt"],
          target_dir: "/b/",
          overwrite: true,
        },
      });
    });

    it("submits delete job with paths", async () => {
      const record = makeJobRecord({ kind: "delete" });
      mockInvoke.mockResolvedValue(record);

      await jobCommands.submitJob({
        kind: "delete",
        paths: ["/a/file.txt"],
        permanent: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith("submit_job", {
        job: {
          kind: "delete",
          paths: ["/a/file.txt"],
          permanent: true,
        },
      });
    });

    it("submits zipDirectory job with path", async () => {
      const record = makeJobRecord({ kind: "zip" });
      mockInvoke.mockResolvedValue(record);

      await jobCommands.submitJob({
        kind: "zipDirectory",
        path: "/a/folder",
      });

      expect(mockInvoke).toHaveBeenCalledWith("submit_job", {
        job: {
          kind: "zipDirectory",
          path: "/a/folder",
        },
      });
    });

    it("submits zipSelection job with snake_case fields", async () => {
      const record = makeJobRecord({ kind: "zip" });
      mockInvoke.mockResolvedValue(record);

      await jobCommands.submitJob({
        kind: "zipSelection",
        paths: ["/a/file.txt", "/a/file2.txt"],
        targetDir: "/b/",
        archiveName: "archive.zip",
      });

      expect(mockInvoke).toHaveBeenCalledWith("submit_job", {
        job: {
          kind: "zipSelection",
          paths: ["/a/file.txt", "/a/file2.txt"],
          target_dir: "/b/",
          archive_name: "archive.zip",
        },
      });
    });
  });
});
