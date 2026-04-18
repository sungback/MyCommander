import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { listen } from "@tauri-apps/api/event";
import { useDialogStore } from "../../store/dialogStore";
import { formatSize } from "../../utils/format";
import { useFileSystem } from "../../hooks/useFileSystem";

interface ProgressPayload {
  operation: "copy" | "move" | "zip";
  current: number;
  total: number;
  currentFile: string;
  unit: "items" | "bytes";
}

export const ProgressDialog: React.FC = () => {
  const { openDialog } = useDialogStore();
  const { cancelZipOperation } = useFileSystem();
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (openDialog !== "progress") {
      setProgress(null);
      setIsCancelling(false);
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<ProgressPayload>("fs-progress", (event) => {
      if (!cancelled) {
        setProgress(event.payload);
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [openDialog]);

  const isOpen = openDialog === "progress";
  const percent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const operationLabel =
    progress?.operation === "move"
      ? "Moving"
      : progress?.operation === "zip"
        ? "Compressing"
        : "Copying";
  const canCancel = progress?.operation === "zip";
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
          <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
            {operationLabel} Files...
          </Dialog.Title>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="truncate max-w-[340px]">
                {progress ? (
                  <span className="text-text-primary font-mono">{progress.currentFile}</span>
                ) : (
                  "Preparing..."
                )}
              </span>
              <span className="shrink-0 ml-2">
                {progressText}
              </span>
            </div>

            <div className="w-full bg-bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-accent-color h-2 rounded-full transition-all duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>

            <p className="text-xs text-text-secondary text-right">{percent}%</p>

            {canCancel ? (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isCancelling) {
                      return;
                    }

                    setIsCancelling(true);
                    void cancelZipOperation().catch((error) => {
                      console.error("Failed to cancel archive creation:", error);
                      setIsCancelling(false);
                    });
                  }}
                  disabled={isCancelling}
                  className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCancelling ? "Cancelling..." : "Cancel"}
                </button>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
