import { beforeEach, describe, expect, it } from "vitest";
import { useJobStore } from "./jobStore";
import type { JobRecord } from "../types/job";

const queuedJob: JobRecord = {
  id: "job-1",
  kind: "copy",
  status: "queued",
  createdAt: 1,
  updatedAt: 1,
  progress: { current: 0, total: 2, currentFile: "", unit: "items" },
  error: null,
  result: null,
};

const runningJob: JobRecord = {
  id: "job-2",
  kind: "move",
  status: "running",
  createdAt: 2,
  updatedAt: 2,
  progress: { current: 1, total: 3, currentFile: "a.txt", unit: "items" },
  error: null,
  result: null,
};

const failedJob: JobRecord = {
  id: "job-3",
  kind: "delete",
  status: "failed",
  createdAt: 3,
  updatedAt: 3,
  progress: { current: 1, total: 2, currentFile: "b.txt", unit: "items" },
  error: "Disk full",
  result: null,
};

beforeEach(() => {
  useJobStore.setState(useJobStore.getInitialState());
});

describe("jobStore", () => {
  it("hydrates and sorts jobs by createdAt", () => {
    useJobStore.getState().hydrateJobs([failedJob, queuedJob, runningJob]);

    expect(useJobStore.getState().jobs.map((job) => job.id)).toEqual([
      "job-1",
      "job-2",
      "job-3",
    ]);
  });

  it("upserts a job update by id", () => {
    useJobStore.getState().hydrateJobs([queuedJob]);
    useJobStore.getState().upsertJob({
      ...queuedJob,
      status: "running",
      updatedAt: 2,
      progress: { current: 1, total: 2, currentFile: "a.txt", unit: "items" },
    });

    const [job] = useJobStore.getState().jobs;
    expect(job.status).toBe("running");
    expect(job.progress.currentFile).toBe("a.txt");
  });

  it("groups active, failed, and finished jobs", () => {
    useJobStore.getState().hydrateJobs([
      queuedJob,
      runningJob,
      failedJob,
      {
        ...queuedJob,
        id: "job-4",
        status: "completed",
        createdAt: 4,
        updatedAt: 4,
      },
    ]);

    const state = useJobStore.getState();
    expect(state.activeJob?.id).toBe("job-2");
    expect(state.runningJobs.map((job) => job.id)).toEqual(["job-2"]);
    expect(state.queuedJobs.map((job) => job.id)).toEqual(["job-1"]);
    expect(state.failedJobs.map((job) => job.id)).toEqual(["job-3"]);
    expect(state.finishedJobs.map((job) => job.id)).toEqual(["job-4"]);
  });

  it("clears finished jobs from local state", () => {
    useJobStore.getState().hydrateJobs([
      queuedJob,
      { ...queuedJob, id: "job-4", status: "completed", createdAt: 4, updatedAt: 4 },
      { ...queuedJob, id: "job-5", status: "cancelled", createdAt: 5, updatedAt: 5 },
    ]);

    useJobStore.getState().clearFinishedJobsLocal();

    expect(useJobStore.getState().jobs.map((job) => job.id)).toEqual(["job-1"]);
  });
});
