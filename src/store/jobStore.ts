import { create } from "zustand";
import type { JobRecord, JobStatus } from "../types/job";

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

// 작업 상태의 진행 순서. completed·failed·cancelled는 모두 끝난 상태로 같은 단계다.
const STATUS_ORDER: Record<JobStatus, number> = {
  queued: 0,
  running: 1,
  completed: 2,
  failed: 2,
  cancelled: 2,
};

// 같은 작업에 대한 갱신은 job-updated 이벤트와 submit_job 응답 등 여러 경로로 오고, 도착 순서가 뒤바뀔 수 있다.
// 빨리 끝난 작업의 completed 이벤트 뒤에 늦게 도착한 queued 응답이 상태를 되돌리지 않도록,
// 더 앞 단계이거나 같은 단계에서 더 오래된 갱신은 버린다.
const shouldReplaceJob = (current: JobRecord, incoming: JobRecord) => {
  const currentOrder = STATUS_ORDER[current.status];
  const incomingOrder = STATUS_ORDER[incoming.status];
  if (incomingOrder !== currentOrder) {
    return incomingOrder > currentOrder;
  }
  return incoming.updatedAt >= current.updatedAt;
};

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
      const existing = state.jobs.find((entry) => entry.id === job.id);
      if (!existing) {
        return createState([...state.jobs, job]);
      }
      if (!shouldReplaceJob(existing, job)) {
        return state;
      }
      return createState(
        state.jobs.map((entry) => (entry.id === job.id ? job : entry))
      );
    }),
  clearFinishedJobsLocal: () =>
    set((state) =>
      createState(
        state.jobs.filter(
          (job) => job.status === "queued" || job.status === "running"
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
