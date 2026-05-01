import type { JobRecord } from "../../types/job";
import { formatSize } from "../../utils/format";

export type JobCenterFilter = "all" | "running" | "queued" | "failed" | "finished";
export type JobSortOrder = "oldest" | "newest";

export const formatProgress = (job: JobRecord) => {
  if (job.progress.total <= 0) {
    return "Preparing...";
  }

  return job.progress.unit === "bytes"
    ? `${formatSize(job.progress.current)} / ${formatSize(job.progress.total)}`
    : `${job.progress.current} / ${job.progress.total}`;
};

export const titleForKind = (kind: JobRecord["kind"]) => {
  switch (kind) {
    case "copy":
      return "Copy";
    case "move":
      return "Move";
    case "delete":
      return "Delete";
    case "zip":
      return "Zip";
    default:
      return kind;
  }
};

export const sortJobs = (jobs: JobRecord[], sortOrder: JobSortOrder) =>
  [...jobs].sort((a, b) =>
    sortOrder === "newest"
      ? b.createdAt - a.createdAt
      : a.createdAt - b.createdAt
  );

export const shouldShowJobSection = (
  filter: JobCenterFilter,
  section: Exclude<JobCenterFilter, "all">
) => filter === "all" || filter === section;
