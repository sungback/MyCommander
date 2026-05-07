import React from "react";
import type { JobRecord } from "../../types/job";
import { formatDate } from "../../utils/format";
import { formatProgress, titleForKind } from "./jobCenterHelpers";

interface JobDetailsPaneProps {
  selectedJob: JobRecord | null;
  onClearSelection: () => void;
}

export const JobDetailsPane: React.FC<JobDetailsPaneProps> = ({
  selectedJob,
  onClearSelection,
}) => (
  <aside className="rounded-md border border-border-color bg-bg-secondary p-3 text-xs text-text-secondary">
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-text-primary">Job details</h3>
      {selectedJob ? (
        <button
          type="button"
          onClick={onClearSelection}
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
          <div className="mt-1 break-words">
            {selectedJob.progress.currentFile || "Preparing..."}
          </div>
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
                <li key={path} className="break-all">
                  {path}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {selectedJob.result?.affectedEntryPaths?.length ? (
          <div>
            <div className="font-medium text-text-primary">Affected paths</div>
            <ul className="mt-1 space-y-1">
              {selectedJob.result.affectedEntryPaths.map((path) => (
                <li key={path} className="break-all">
                  {path}
                </li>
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
);
