import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { listen } from "@tauri-apps/api/event";
import { useDialogStore } from "../../store/dialogStore";
import { formatSize } from "../../utils/format";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useJobStore } from "../../store/jobStore";

interface ProgressPayload {
  operation: "copy" | "move" | "zip" | "delete";
  current: number;
  total: number;
  currentFile: string;
  unit: "items" | "bytes";
}

export const ProgressDialog: React.FC = () => {
  const { openDialog, closeDialog } = useDialogStore();
  const { cancelJob, clearFinishedJobs, retryJob } = useFileSystem();
  const activeJob = useJobStore((state) => state.activeJob);
  const queuedJobs = useJobStore((state) => state.queuedJobs);
  const failedJobs = useJobStore((state) => state.failedJobs);
  const finishedJobs = useJobStore((state) => state.finishedJobs);
  const clearFinishedJobsLocal = useJobStore((state) => state.clearFinishedJobsLocal);
  const upsertJob = useJobStore((state) => state.upsertJob);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isClearingFinished, setIsClearingFinished] = useState(false);

  useEffect(() => {
    if (openDialog !== "progress") {
      setProgress(null);
      setIsCancelling(false);
      setIsRetrying(false);
      setIsClearingFinished(false);
      return;
    }

    let cancelled = false;
    let unlistenProgress: (() => void) | undefined;

    void listen<ProgressPayload>("fs-progress", (event) => {
      if (!cancelled) {
        setProgress(event.payload);
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenProgress = fn;
      }
    });

    return () => {
      cancelled = true;
      unlistenProgress?.();
    };
  }, [openDialog]);

  useEffect(() => {
    if (openDialog !== "progress") {
      return;
    }

    const hasRunningOrQueued = Boolean(activeJob);
    const hasFailed = failedJobs.length > 0;

    if (!hasRunningOrQueued && !hasFailed) {
      closeDialog();
    }
  }, [activeJob, closeDialog, failedJobs.length, openDialog]);

  useEffect(() => {
    setProgress(null);
  }, [activeJob?.id]);

  const isOpen = openDialog === "progress";
  const latestFailedJob = failedJobs.length > 0 ? failedJobs[failedJobs.length - 1] : null;
  const percent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const operationLabel =
    activeJob?.kind === "move" || progress?.operation === "move"
      ? "Moving"
      : activeJob?.kind === "delete" || progress?.operation === "delete"
        ? "Deleting"
        : activeJob?.kind === "zip" || progress?.operation === "zip"
          ? "Compressing"
          : "Copying";
  const progressText = progress
    ? progress.unit === "bytes"
      ? `${formatSize(progress.current)} / ${formatSize(progress.total)}`
      : `${progress.current} / ${progress.total}`
    : "";

  return (
    <Dialog.Root open={isOpen} onOpenChange={() => {}}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[450px] z-50 p-4 focus:outline-none text-text-primary"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <Dialog.Description className="sr-only">
            Displays progress for long-running file system operations.
          </Dialog.Description>
          <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
            {operationLabel} Files...
          </Dialog.Title>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="truncate max-w-[340px]">
                {progress ? (
                  <span className="text-text-primary font-mono">{progress.currentFile}</span>
                ) : (
                  activeJob?.progress.currentFile || "Preparing..."
                )}
              </span>
              <span className="shrink-0 ml-2">{progressText}</span>
            </div>

            <div className="w-full bg-bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-accent-color h-2 rounded-full transition-all duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>

            <p className="text-xs text-text-secondary text-right">{percent}%</p>

            <div className="flex items-center justify-between text-[11px] text-text-secondary">
              <span>Queued: {queuedJobs.length}</span>
              <span>Failed: {failedJobs.length}</span>
            </div>

            {latestFailedJob ? (
              <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-text-secondary">
                <span className="block font-medium text-text-primary">
                  Last failed job: {latestFailedJob.kind}
                </span>
                {latestFailedJob.error ? (
                  <span className="block mt-1 break-words text-red-400">
                    {latestFailedJob.error}
                  </span>
                ) : null}
              </div>
            ) : null}

            {activeJob || latestFailedJob || finishedJobs.length > 0 ? (
              <div className="flex justify-end gap-2 pt-1">
                {latestFailedJob ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isRetrying) {
                        return;
                      }

                      setIsRetrying(true);
                      void retryJob(latestFailedJob.id)
                        .then((job) => {
                          upsertJob(job);
                        })
                        .finally(() => {
                          setIsRetrying(false);
                        });
                    }}
                    disabled={isRetrying}
                    className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRetrying ? "Retrying..." : "Retry failed"}
                  </button>
                ) : null}
                {finishedJobs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isClearingFinished) {
                        return;
                      }

                      setIsClearingFinished(true);
                      void clearFinishedJobs()
                        .then(() => {
                          clearFinishedJobsLocal();
                        })
                        .finally(() => {
                          setIsClearingFinished(false);
                        });
                    }}
                    disabled={isClearingFinished}
                    className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isClearingFinished ? "Clearing..." : "Clear finished"}
                  </button>
                ) : null}
                {activeJob ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isCancelling) {
                        return;
                      }

                      setIsCancelling(true);
                      void cancelJob(activeJob.id)
                        .then((job) => {
                          upsertJob(job);
                        })
                        .finally(() => {
                          setIsCancelling(false);
                        });
                    }}
                    disabled={isCancelling}
                    className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCancelling ? "Cancelling..." : "Cancel"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
