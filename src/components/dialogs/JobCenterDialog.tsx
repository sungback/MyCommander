import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDialogStore } from "../../store/dialogStore";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useJobStore } from "../../store/jobStore";
import { JobCenterSection } from "./JobCenterSection";
import { JobDetailsPane } from "./JobDetailsPane";
import type { JobCenterFilter, JobSortOrder } from "./jobCenterHelpers";
import { shouldShowJobSection } from "./jobCenterHelpers";

export const JobCenterDialog: React.FC = () => {
  const { openDialog, closeDialog } = useDialogStore();
  const { cancelJob, clearFinishedJobs, retryJob } = useFileSystem();
  const runningJobs = useJobStore((state) => state.runningJobs);
  const queuedJobs = useJobStore((state) => state.queuedJobs);
  const failedJobs = useJobStore((state) => state.failedJobs);
  const finishedJobs = useJobStore((state) => state.finishedJobs);
  const clearFinishedJobsLocal = useJobStore((state) => state.clearFinishedJobsLocal);
  const upsertJob = useJobStore((state) => state.upsertJob);
  const isOpen = openDialog === "jobcenter";
  const [activeFilter, setActiveFilter] = React.useState<JobCenterFilter>("all");
  const [sortOrder, setSortOrder] = React.useState<JobSortOrder>("oldest");
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);

  const allJobs = useJobStore((state) => state.jobs);
  const selectedJob =
    selectedJobId !== null
      ? allJobs.find((job) => job.id === selectedJobId) ?? null
      : null;

  const handleClearFinishedJobs = React.useCallback(() => {
    void clearFinishedJobs()
      .then(() => {
        clearFinishedJobsLocal();
      })
      .catch((error) => {
        console.error("Failed to clear finished jobs:", error);
      });
  }, [clearFinishedJobs, clearFinishedJobsLocal]);

  const handleCancelJob = React.useCallback(
    (jobId: string) => {
      void cancelJob(jobId)
        .then((cancelledJob) => {
          upsertJob(cancelledJob);
        })
        .catch((error) => {
          console.error("Failed to cancel job:", error);
        });
    },
    [cancelJob, upsertJob]
  );

  const handleRetryJob = React.useCallback(
    (jobId: string) => {
      void retryJob(jobId)
        .then((retriedJob) => {
          upsertJob(retriedJob);
        })
        .catch((error) => {
          console.error("Failed to retry job:", error);
        });
    },
    [retryJob, upsertJob]
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 max-h-[85vh] w-[min(92vw,780px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border-color bg-bg-panel p-4 text-text-primary shadow-xl focus:outline-none">
          <Dialog.Description className="sr-only">
            Displays queued, running, failed, and finished background jobs.
          </Dialog.Description>
          <div className="mb-4 flex items-center justify-between border-b border-border-color pb-2">
            <Dialog.Title className="text-base font-semibold">Job Center</Dialog.Title>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearFinishedJobs}
                className="rounded-md border border-border-color px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-hover"
              >
                Clear finished
              </button>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md border border-border-color px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-hover"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {([
              ["all", "All"],
              ["running", "Running"],
              ["queued", "Queued"],
              ["failed", "Failed"],
              ["finished", "Finished"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveFilter(value)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  activeFilter === value
                    ? "border-accent-color bg-bg-hover text-text-primary"
                    : "border-border-color text-text-secondary hover:bg-bg-hover"
                }`}
              >
                {label}
              </button>
            ))}

            <label className="ml-auto flex items-center gap-2 text-xs text-text-secondary">
              <span>Sort</span>
              <select
                aria-label="Sort jobs"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as JobSortOrder)}
                className="rounded-md border border-border-color bg-bg-secondary px-2 py-1 text-xs text-text-primary"
              >
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4 overflow-hidden">
            <div className="space-y-4 overflow-y-auto pr-1" style={{ maxHeight: "calc(85vh - 96px)" }}>
              {shouldShowJobSection(activeFilter, "running") ? (
                <JobCenterSection
                  title="Running"
                  items={runningJobs}
                  sectionKey="running"
                  sortOrder={sortOrder}
                  selectedJobId={selectedJobId}
                  emptyText="No running jobs"
                  allowCancel
                  onSelectJob={setSelectedJobId}
                  onCancelJob={handleCancelJob}
                  onRetryJob={handleRetryJob}
                />
              ) : null}
              {shouldShowJobSection(activeFilter, "queued") ? (
                <JobCenterSection
                  title="Queued"
                  items={queuedJobs}
                  sectionKey="queued"
                  sortOrder={sortOrder}
                  selectedJobId={selectedJobId}
                  emptyText="No queued jobs"
                  allowCancel
                  onSelectJob={setSelectedJobId}
                  onCancelJob={handleCancelJob}
                  onRetryJob={handleRetryJob}
                />
              ) : null}
              {shouldShowJobSection(activeFilter, "failed") ? (
                <JobCenterSection
                  title="Failed"
                  items={failedJobs}
                  sectionKey="failed"
                  sortOrder={sortOrder}
                  selectedJobId={selectedJobId}
                  emptyText="No failed jobs"
                  allowRetry
                  onSelectJob={setSelectedJobId}
                  onCancelJob={handleCancelJob}
                  onRetryJob={handleRetryJob}
                />
              ) : null}
              {shouldShowJobSection(activeFilter, "finished") ? (
                <JobCenterSection
                  title="Finished"
                  items={finishedJobs}
                  sectionKey="finished"
                  sortOrder={sortOrder}
                  selectedJobId={selectedJobId}
                  emptyText="No completed or cancelled jobs"
                  onSelectJob={setSelectedJobId}
                  onCancelJob={handleCancelJob}
                  onRetryJob={handleRetryJob}
                />
              ) : null}
            </div>

            <JobDetailsPane
              selectedJob={selectedJob}
              onClearSelection={() => setSelectedJobId(null)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
