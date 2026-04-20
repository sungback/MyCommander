export type JobKind = "copy" | "move" | "delete" | "zip";

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobProgress {
  current: number;
  total: number;
  currentFile: string;
  unit: "items" | "bytes";
}

export interface JobResult {
  affectedDirectories: string[];
  affectedEntryPaths: string[];
  archivePath?: string | null;
  savedNames?: string[];
}

export interface JobRecord {
  id: string;
  kind: JobKind;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  progress: JobProgress;
  error?: string | null;
  result?: JobResult | null;
}

export type JobSubmission =
  | {
      kind: "copy";
      sourcePaths: string[];
      targetPath: string;
      keepBoth?: boolean;
    }
  | {
      kind: "move";
      sourcePaths: string[];
      targetDir: string;
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
      targetDir: string;
      archiveName: string;
    };
