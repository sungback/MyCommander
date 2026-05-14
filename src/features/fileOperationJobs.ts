import {
  buildMoveUndoEntries,
  useFileOperationUndoStore,
  type FileOperationUndoOperation,
} from "../store/fileOperationUndoStore";
import type { PanelPathLike } from "../utils/panelPath";
import { getPanelAccessPath, getPanelDisplayPath } from "../utils/panelPath";
import { getPathDirectoryName } from "../utils/path";
import type { JobRecord, JobSubmission } from "../types/job";

export interface FileOperationJobClient {
  submitJob: (job: JobSubmission) => Promise<JobRecord>;
}

export interface FileOperationMoveClient {
  moveFiles: (
    sourcePaths: string[],
    targetDir: string,
    overwrite?: boolean
  ) => Promise<void>;
}

export interface SubmitCopyJobArgs {
  sourcePaths: string[];
  targetPath: string;
  keepBoth?: boolean;
  overwrite?: boolean;
}

export interface SubmitMoveJobWithUndoArgs {
  client: FileOperationJobClient;
  sourcePaths: string[];
  targetDir: string;
  targetIsDirectory: boolean;
  overwrite?: boolean;
}

export const getArchiveStem = (path: string) =>
  path.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean).pop() || "Archive";

export const buildZipSelectionJob = (
  paths: string[],
  panel: PanelPathLike
): JobSubmission => ({
  kind: "zipSelection",
  paths,
  targetDir: getPanelAccessPath(panel),
  archiveName: getArchiveStem(getPanelDisplayPath(panel)),
});

export const buildZipDirectoryJob = (path: string): JobSubmission => ({
  kind: "zipDirectory",
  path,
});

export const submitZipSelectionJob = (
  client: FileOperationJobClient,
  paths: string[],
  panel: PanelPathLike
) => client.submitJob(buildZipSelectionJob(paths, panel));

export const submitZipDirectoryJob = (
  client: FileOperationJobClient,
  path: string
) => client.submitJob(buildZipDirectoryJob(path));

export const buildCopyJob = ({
  sourcePaths,
  targetPath,
  keepBoth,
  overwrite,
}: SubmitCopyJobArgs): JobSubmission => ({
  kind: "copy",
  sourcePaths,
  targetPath,
  keepBoth,
  ...(overwrite ? { overwrite: true } : {}),
});

export const submitCopyJob = (
  client: FileOperationJobClient,
  args: SubmitCopyJobArgs
) => client.submitJob(buildCopyJob(args));

export const submitMoveJobWithUndo = async ({
  client,
  sourcePaths,
  targetDir,
  targetIsDirectory,
  overwrite,
}: SubmitMoveJobWithUndoArgs) => {
  const job = await client.submitJob({
    kind: "move",
    sourcePaths,
    targetDir,
    ...(overwrite ? { overwrite: true } : {}),
  });

  if (job?.id) {
    useFileOperationUndoStore.getState().registerPendingMoveUndo(
      job.id,
      buildMoveUndoEntries(sourcePaths, targetDir, { targetIsDirectory })
    );
  }

  return job;
};

export const getUndoRefreshDirectories = (
  operation: FileOperationUndoOperation
) =>
  Array.from(
    new Set(
      operation.entries.flatMap((entry) => [
        getPathDirectoryName(entry.originalPath),
        getPathDirectoryName(entry.currentPath),
      ])
    )
  );

export const undoFileOperation = async (
  client: FileOperationMoveClient,
  operation: FileOperationUndoOperation
) => {
  const refreshDirectories = getUndoRefreshDirectories(operation);

  for (const entry of [...operation.entries].reverse()) {
    await client.moveFiles([entry.currentPath], entry.originalPath);
  }

  useFileOperationUndoStore.getState().clearLastOperation();
  return refreshDirectories;
};
