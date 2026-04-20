import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { useFileSystem } from "./useFileSystem";
import { useJobStore } from "../store/jobStore";
import type { JobRecord } from "../types/job";
import { useDialogStore } from "../store/dialogStore";
import {
  refreshPanelsForDirectories,
  refreshPanelsForEntryPaths,
  removeDeletedPathsFromVisiblePanels,
} from "../store/panelRefresh";

export const useJobQueue = () => {
  const { listJobs } = useFileSystem();
  const hydrateJobs = useJobStore((state) => state.hydrateJobs);
  const upsertJob = useJobStore((state) => state.upsertJob);
  const jobStatusRef = useRef<Record<string, JobRecord["status"]>>({});

  useEffect(() => {
    let cancelled = false;
    let unlistenJobs: (() => void) | undefined;

    void listJobs()
      .then((jobs) => {
        if (!cancelled) {
          hydrateJobs(jobs);
          jobStatusRef.current = Object.fromEntries(
            jobs.map((job) => [job.id, job.status])
          );
          const shouldOpenProgress = jobs.some(
            (job) =>
              job.status === "queued" ||
              job.status === "running" ||
              job.status === "failed"
          );

          if (shouldOpenProgress && useDialogStore.getState().openDialog === null) {
            useDialogStore.getState().setOpenDialog("progress");
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to restore pending jobs:", error);
        }
      });

    void listen<JobRecord>("job-updated", (event) => {
      if (cancelled) {
        return;
      }

      const job = event.payload;
      const previousStatus = jobStatusRef.current[job.id];
      jobStatusRef.current[job.id] = job.status;
      upsertJob(job);

      const reachedTerminalState =
        previousStatus !== job.status &&
        (job.status === "completed" ||
          job.status === "failed" ||
          job.status === "cancelled");

      if (!reachedTerminalState || !job.result) {
        return;
      }

      if (job.kind === "delete" && job.result.affectedEntryPaths.length > 0) {
        removeDeletedPathsFromVisiblePanels(job.result.affectedEntryPaths);
        refreshPanelsForEntryPaths(job.result.affectedEntryPaths);
        return;
      }

      if (job.result.affectedDirectories.length > 0) {
        refreshPanelsForDirectories(job.result.affectedDirectories);
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenJobs = fn;
      }
    });

    return () => {
      cancelled = true;
      jobStatusRef.current = {};
      unlistenJobs?.();
    };
  }, [hydrateJobs, listJobs, upsertJob]);
};
