import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDialogStore } from "../../store/dialogStore";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useJobStore } from "../../store/jobStore";
import { JobRecord } from "../../types/job";
import { formatDate, formatSize } from "../../utils/format";

type JobCenterFilter = "all" | "running" | "queued" | "failed" | "finished";
type JobSortOrder = "oldest" | "newest";

const formatProgress = (job: JobRecord) => {
  if (job.progress.total <= 0) {
    return "Preparing...";
  }

  return job.progress.unit === "bytes"
    ? `${formatSize(job.progress.current)} / ${formatSize(job.progress.total)}`
    : `${job.progress.current} / ${job.progress.total}`;
};

const titleForKind = (kind: JobRecord["kind"]) => {
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

  const sortJobs = React.useCallback(
    (jobs: JobRecord[]) =>
      [...jobs].sort((a, b) =>
        sortOrder === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
      ),
    [sortOrder]
  );

  const showSection = (filter: JobCenterFilter, section: Exclude<JobCenterFilter, "all">) =>
    filter === "all" || filter === section;

  const renderSection = (
    title: string,
    items: JobRecord[],
    sectionKey: Exclude<JobCenterFilter, "all">,
    options: {
      emptyText?: string;
      allowCancel?: boolean;
      allowRetry?: boolean;
    } = {}
  ) => {
    const sortedItems = sortJobs(items);

    return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className="text-xs text-text-secondary">{sortedItems.length}</span>
      </div>
      {sortedItems.length === 0 ? (
        <div className="rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-xs text-text-secondary">
          {options.emptyText}
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
              onClick={() => setSelectedJobId(job.id)}
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
              {options.allowCancel || options.allowRetry ? (
                <div className="mt-2 flex justify-end gap-2">
                  {options.allowRetry ? (
                    <button
                      type="button"
                      onClick={() => {
                        void retryJob(job.id)
                          .then((retriedJob) => {
                            upsertJob(retriedJob);
                          })
                          .catch((error) => {
                            console.error("Failed to retry job:", error);
                          });
                      }}
                      className="rounded-md border border-border-color px-2 py-1 text-xs text-text-primary transition-colors hover:bg-bg-hover"
                    >
                      Retry
                    </button>
                  ) : null}
                  {options.allowCancel ? (
                    <button
                      type="button"
                      onClick={() => {
                        void cancelJob(job.id)
                          .then((cancelledJob) => {
                            upsertJob(cancelledJob);
                          })
                          .catch((error) => {
                            console.error("Failed to cancel job:", error);
                          });
                      }}
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
                onClick={() => {
                  void clearFinishedJobs()
                    .then(() => {
                      clearFinishedJobsLocal();
                    })
                    .catch((error) => {
                      console.error("Failed to clear finished jobs:", error);
                    });
                }}
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
              {showSection(activeFilter, "running") && renderSection("Running", runningJobs, "running", {
                emptyText: "No running jobs",
                allowCancel: true,
              })}
              {showSection(activeFilter, "queued") && renderSection("Queued", queuedJobs, "queued", {
                emptyText: "No queued jobs",
                allowCancel: true,
              })}
              {showSection(activeFilter, "failed") && renderSection("Failed", failedJobs, "failed", {
                emptyText: "No failed jobs",
                allowRetry: true,
              })}
              {showSection(activeFilter, "finished") && renderSection("Finished", finishedJobs, "finished", {
                emptyText: "No completed or cancelled jobs",
              })}
            </div>

            <aside className="rounded-md border border-border-color bg-bg-secondary p-3 text-xs text-text-secondary">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Job details</h3>
                {selectedJob ? (
                  <button
                    type="button"
                    onClick={() => setSelectedJobId(null)}
                    className="rounded-md border border-border-color px-2 py-1 text-xs text-text-primary transition-colors hover:bg-bg-hover"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {selectedJob ? (
                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-text-primary">
                      {titleForKind(selectedJob.kind)} · {selectedJob.id}
                    </div>
                    <div className="mt-1">Status: {selectedJob.status}</div>
                    <div className="mt-1">Updated {formatDate(selectedJob.updatedAt)}</div>
                  </div>

                  <div>
                    <div className="font-medium text-text-primary">Progress</div>
                    <div className="mt-1">{formatProgress(selectedJob)}</div>
                    <div className="mt-1 break-words">{selectedJob.progress.currentFile || "Preparing..."}</div>
                  </div>

                  {selectedJob.error ? (
                    <div>
                      <div className="font-medium text-text-primary">Error</div>
                      <div className="mt-1 break-words text-red-400">{selectedJob.error}</div>
                    </div>
                  ) : null}

                  {selectedJob.result?.affectedDirectories?.length ? (
                    <div>
                      <div className="font-medium text-text-primary">Affected directories</div>
                      <ul className="mt-1 space-y-1">
                        {selectedJob.result.affectedDirectories.map((path) => (
                          <li key={path} className="break-all">{path}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selectedJob.result?.affectedEntryPaths?.length ? (
                    <div>
                      <div className="font-medium text-text-primary">Affected paths</div>
                      <ul className="mt-1 space-y-1">
                        {selectedJob.result.affectedEntryPaths.map((path) => (
                          <li key={path} className="break-all">{path}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selectedJob.result?.savedNames?.length ? (
                    <div>
                      <div className="font-medium text-text-primary">Saved names</div>
                      <ul className="mt-1 space-y-1">
                        {selectedJob.result.savedNames.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selectedJob.result?.archivePath ? (
                    <div>
                      <div className="font-medium text-text-primary">Archive path</div>
                      <div className="mt-1 break-all">{selectedJob.result.archivePath}</div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-text-secondary">Select a job to inspect its details.</div>
              )}
            </aside>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
