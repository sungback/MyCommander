import { invoke } from "@tauri-apps/api/core";
import { JobRecord, JobSubmission } from "../../types/job";

type TauriJobSubmission =
  | {
      kind: "copy";
      source_paths: string[];
      target_path: string;
      keep_both?: boolean;
    }
  | {
      kind: "move";
      source_paths: string[];
      target_dir: string;
    }
  | {
      kind: "delete";
      paths: string[];
      permanent?: boolean;
    }
  | {
      kind: "zipDirectory";
      path: string;
    }
  | {
      kind: "zipSelection";
      paths: string[];
      target_dir: string;
      archive_name: string;
    };

const toTauriJobSubmission = (job: JobSubmission): TauriJobSubmission => {
  switch (job.kind) {
    case "copy":
      return {
        kind: "copy",
        source_paths: job.sourcePaths,
        target_path: job.targetPath,
        keep_both: job.keepBoth,
      };
    case "move":
      return {
        kind: "move",
        source_paths: job.sourcePaths,
        target_dir: job.targetDir,
      };
    case "delete":
      return {
        kind: "delete",
        paths: job.paths,
        permanent: job.permanent,
      };
    case "zipDirectory":
      return {
        kind: "zipDirectory",
        path: job.path,
      };
    case "zipSelection":
      return {
        kind: "zipSelection",
        paths: job.paths,
        target_dir: job.targetDir,
        archive_name: job.archiveName,
      };
  }
};

export const jobCommands = {
  submitJob: async (job: JobSubmission): Promise<JobRecord> => {
    return await invoke<JobRecord>("submit_job", { job: toTauriJobSubmission(job) });
  },

  listJobs: async (): Promise<JobRecord[]> => {
    return await invoke<JobRecord[]>("list_jobs");
  },

  cancelJob: async (jobId: string): Promise<JobRecord> => {
    return await invoke<JobRecord>("cancel_job", { job_id: jobId });
  },

  retryJob: async (jobId: string): Promise<JobRecord> => {
    return await invoke<JobRecord>("retry_job", { job_id: jobId });
  },

  clearFinishedJobs: async (): Promise<void> => {
    await invoke("clear_finished_jobs");
  },
};
