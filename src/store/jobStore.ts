import { create } from "zustand";
import type { JobRecord } from "../types/job";

interface JobState {
  jobs: JobRecord[];
  hydrateJobs: (jobs: JobRecord[]) => void;
  upsertJob: (job: JobRecord) => void;
  clearFinishedJobsLocal: () => void;
  resetJobs: () => void;
  activeJob: JobRecord | null;
  runningJobs: JobRecord[];
  queuedJobs: JobRecord[];
  failedJobs: JobRecord[];
  finishedJobs: JobRecord[];
}

const sortJobs = (jobs: JobRecord[]) =>
  [...jobs].sort((a, b) => a.createdAt - b.createdAt);

const deriveSlices = (jobs: JobRecord[]) => {
  const activeJob =
    jobs.find((job) => job.status === "running") ??
    jobs.find((job) => job.status === "queued") ??
    null;
  const runningJobs = jobs.filter((job) => job.status === "running");
  const queuedJobs = jobs.filter((job) => job.status === "queued");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const finishedJobs = jobs.filter(
    (job) => job.status === "completed" || job.status === "cancelled"
  );

  return {
    activeJob,
    runningJobs,
    queuedJobs,
    failedJobs,
    finishedJobs,
  };
};

const createState = (jobs: JobRecord[] = []) => {
  const sortedJobs = sortJobs(jobs);
  return {
    jobs: sortedJobs,
    ...deriveSlices(sortedJobs),
  };
};

export const useJobStore = create<JobState>((set) => ({
  ...createState(),
  hydrateJobs: (jobs) => set(createState(jobs)),
  upsertJob: (job) =>
    set((state) => {
      const jobs = state.jobs.some((entry) => entry.id === job.id)
        ? state.jobs.map((entry) => (entry.id === job.id ? job : entry))
        : [...state.jobs, job];
      return createState(jobs);
    }),
  clearFinishedJobsLocal: () =>
    set((state) =>
      createState(
        state.jobs.filter(
          (job) => job.status === "queued" || job.status === "running" || job.status === "failed"
        )
      )
    ),
  resetJobs: () => set(createState()),
  activeJob: null,
  runningJobs: [],
  queuedJobs: [],
  failedJobs: [],
  finishedJobs: [],
}));
