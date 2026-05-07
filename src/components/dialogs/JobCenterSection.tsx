import React from "react";
import type { JobRecord } from "../../types/job";
import { formatDate } from "../../utils/format";
import type { JobCenterFilter, JobSortOrder } from "./jobCenterHelpers";
import { formatProgress, sortJobs, titleForKind } from "./jobCenterHelpers";

type JobCenterSectionKey = Exclude<JobCenterFilter, "all">;

interface JobCenterSectionProps {
  title: string;
  items: JobRecord[];
  sectionKey: JobCenterSectionKey;
  sortOrder: JobSortOrder;
  selectedJobId: string | null;
  emptyText: string;
  allowCancel?: boolean;
  allowRetry?: boolean;
  onSelectJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
}

export const JobCenterSection: React.FC<JobCenterSectionProps> = ({
  title,
  items,
  sectionKey,
  sortOrder,
  selectedJobId,
  emptyText,
  allowCancel = false,
  allowRetry = false,
  onSelectJob,
  onCancelJob,
  onRetryJob,
}) => {
  const sortedItems = React.useMemo(
    () => sortJobs(items, sortOrder),
    [items, sortOrder]
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className="text-xs text-text-secondary">{sortedItems.length}</span>
      </div>
      {sortedItems.length === 0 ? (
        <div className="rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-xs text-text-secondary">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((job) => (
            <div
              key={job.id}
              data-testid={`job-card-${sectionKey}`}
              className={`cursor-pointer rounded-md border bg-bg-secondary px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-bg-hover ${
                selectedJobId === job.id ? "border-accent-color" : "border-border-color"
              }`}
              onClick={() => onSelectJob(job.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-text-primary">
                    {titleForKind(job.kind)} · {job.id}
                  </div>
                  <div className="truncate">{job.progress.currentFile || "Preparing..."}</div>
                  <div className="mt-1 text-[11px] text-text-secondary">
                    Updated {formatDate(job.updatedAt)}
                  </div>
                </div>
                <div className="shrink-0 font-mono">{formatProgress(job)}</div>
              </div>
              {job.error ? (
                <div className="mt-2 break-words text-red-400">{job.error}</div>
              ) : null}
              {allowCancel || allowRetry ? (
                <div className="mt-2 flex justify-end gap-2">
                  {allowRetry ? (
                    <button
                      type="button"
                      onClick={() => onRetryJob(job.id)}
                      className="rounded-md border border-border-color px-2 py-1 text-xs text-text-primary transition-colors hover:bg-bg-hover"
                    >
                      Retry
                    </button>
                  ) : null}
                  {allowCancel ? (
                    <button
                      type="button"
                      onClick={() => onCancelJob(job.id)}
                      className="rounded-md border border-border-color px-2 py-1 text-xs text-text-primary transition-colors hover:bg-bg-hover"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
