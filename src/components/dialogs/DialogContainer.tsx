import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import { isAbsolutePath, joinPath } from "../../utils/path";
import { formatDate, formatSize } from "../../utils/format";

// Reusable Radix UI Dialog Wrapper
const BaseDialog: React.FC<{
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
  submitLabel?: string;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  submitAutoFocus?: boolean;
}> = ({
  title,
  isOpen,
  onClose,
  onSubmit,
  children,
  submitLabel = "OK",
  errorMessage = null,
  isSubmitting = false,
  submitAutoFocus = true,
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[450px] z-50 p-4 focus:outline-none text-text-primary">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
              {title}
            </Dialog.Title>
            <div className="mb-6 space-y-3">
              {children}
              {errorMessage ? (
                <p className="text-xs text-red-400">{errorMessage}</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                autoFocus={submitAutoFocus}
                disabled={isSubmitting}
                className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const DialogContainer: React.FC = () => {
  const { openDialog, dialogTarget, closeDialog } = useDialogStore();
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const activePanelId = usePanelStore((s) => s.activePanel);
  const leftPanel = usePanelStore((s) => s.leftPanel);
  const rightPanel = usePanelStore((s) => s.rightPanel);
  
  const fs = useFileSystem();

  // Dialog-specific state
  const [inputValue, setInputValue] = useState("");
  const [infoSize, setInfoSize] = useState<number | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activePanel = activePanelId === "left" ? leftPanel : rightPanel;
  const targetPanel = activePanelId === "left" ? rightPanel : leftPanel;
  const infoPanel = dialogTarget?.panelId === "left" ? leftPanel : rightPanel;
  const infoEntry = dialogTarget
    ? infoPanel.files.find((entry) => entry.path.normalize("NFC") === dialogTarget.path.normalize("NFC")) ?? null
    : null;

  // Determine items to process
  const selectedPaths = Array.from(activePanel.selectedItems);
  if (selectedPaths.length === 0 && activePanel.files[activePanel.cursorIndex]) {
    const cursorFile = activePanel.files[activePanel.cursorIndex];
    if (cursorFile.name !== "..") {
      selectedPaths.push(cursorFile.path);
    }
  }

  // Effect to set default input values when dialog opens
  useEffect(() => {
    if (openDialog === "copy" || openDialog === "move") {
      setInputValue(targetPanel.currentPath);
    } else if (openDialog === "mkdir") {
      setInputValue("New Folder");
    } else if (openDialog === "newfile") {
      setInputValue("New File.txt");
    } else {
      setInputValue("");
    }
  }, [openDialog, targetPanel.currentPath]);

  useEffect(() => {
    setOperationError(null);
    setIsSubmitting(false);
  }, [openDialog]);

  useEffect(() => {
    if (openDialog !== "info" || !dialogTarget || !infoEntry) {
      setInfoSize(null);
      setInfoLoading(false);
      setInfoError(null);
      return;
    }

    if (infoEntry.kind !== "directory") {
      setInfoSize(infoEntry.size ?? null);
      setInfoLoading(false);
      setInfoError(null);
      return;
    }

    if (infoEntry.size !== undefined && infoEntry.size !== null) {
      setInfoSize(infoEntry.size);
      setInfoLoading(false);
      setInfoError(null);
      return;
    }

    let cancelled = false;
    setInfoSize(null);
    setInfoLoading(true);
    setInfoError(null);

    fs.getDirSize(infoEntry.path)
      .then((size) => {
        if (cancelled) return;
        setInfoSize(size);
        updateEntrySize(dialogTarget.panelId, infoEntry.path, size);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to calculate dir size:", error);
        setInfoError("Failed to calculate folder size.");
      })
      .finally(() => {
        if (!cancelled) {
          setInfoLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dialogTarget, infoEntry, openDialog, updateEntrySize]);

  // Handle Operations
  const handleMkdir = async () => {
    if (!inputValue) return;
    try {
      setIsSubmitting(true);
      setOperationError(null);
      const fullPath = joinPath(activePanel.currentPath, inputValue);
      await fs.createDirectory(fullPath);
      closeDialog();
      refreshPanel(activePanelId);
    } catch (e) {
      console.error(e);
      setOperationError(getErrorMessage(e, "Failed to create directory."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewFile = async () => {
    if (!inputValue) return;
    try {
      setIsSubmitting(true);
      setOperationError(null);
      const fullPath = joinPath(activePanel.currentPath, inputValue);
      await fs.createFile(fullPath);
      closeDialog();
      refreshPanel(activePanelId);
    } catch (e) {
      console.error(e);
      setOperationError(getErrorMessage(e, "Failed to create file."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (selectedPaths.length === 0) return;
    try {
      setIsSubmitting(true);
      setOperationError(null);
      await fs.deleteFiles(selectedPaths, false);
      closeDialog();
      refreshPanel(activePanelId);
    } catch (e) {
      console.error(e);
      setOperationError(getErrorMessage(e, "Failed to delete selected items."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveTargetPath = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      return "";
    }

    return isAbsolutePath(trimmedValue)
      ? trimmedValue
      : joinPath(targetPanel.currentPath, trimmedValue);
  };

  const handleCopyMove = async (isMove: boolean) => {
    if (!inputValue || selectedPaths.length === 0) return;
    try {
      setIsSubmitting(true);
      setOperationError(null);
      const targetPath = resolveTargetPath();
      if (isMove) {
        await fs.moveFiles(selectedPaths, targetPath);
      } else {
        await fs.copyFiles(selectedPaths, targetPath);
      }
      closeDialog();
      refreshPanel(activePanelId);
      refreshPanel(activePanelId === "left" ? "right" : "left");
    } catch (e) {
      console.error(e);
      setOperationError(
        getErrorMessage(
          e,
          isMove
            ? "Failed to move selected items."
            : "Failed to copy selected items."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <BaseDialog
        isOpen={openDialog === "mkdir"}
        onClose={closeDialog}
        onSubmit={handleMkdir}
        title="Create New Directory"
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
      >
        <p className="text-xs text-text-secondary mb-2">Create directory in: {activePanel.currentPath}</p>
        <input
          autoFocus
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (operationError) {
              setOperationError(null);
            }
          }}
          className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white"
        />
      </BaseDialog>

      <BaseDialog
        isOpen={openDialog === "newfile"}
        onClose={closeDialog}
        onSubmit={handleNewFile}
        title="Create New File"
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
      >
        <p className="text-xs text-text-secondary mb-2">Create file in: {activePanel.currentPath}</p>
        <input
          autoFocus
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (operationError) {
              setOperationError(null);
            }
          }}
          className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white"
        />
      </BaseDialog>

      <BaseDialog
        isOpen={openDialog === "delete"}
        onClose={closeDialog}
        onSubmit={handleDelete}
        title="Confirm Deletion"
        submitLabel={isSubmitting ? "Deleting..." : "Delete"}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
      >
        <p className="text-sm">
          Do you really want to delete {selectedPaths.length} selected file(s) ?
        </p>
      </BaseDialog>

      <BaseDialog
        isOpen={openDialog === "copy"}
        onClose={closeDialog}
        onSubmit={() => handleCopyMove(false)}
        title={`Copy ${selectedPaths.length} file(s)`}
        submitLabel={isSubmitting ? "Copying..." : "Copy"}
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
      >
        <p className="text-xs text-text-secondary mb-2">Copy to:</p>
        <input
          autoFocus
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (operationError) {
              setOperationError(null);
            }
          }}
          className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white"
        />
      </BaseDialog>

      <BaseDialog
        isOpen={openDialog === "move"}
        onClose={closeDialog}
        onSubmit={() => handleCopyMove(true)}
        title={`Move/Rename ${selectedPaths.length} file(s)`}
        submitLabel={isSubmitting ? "Moving..." : "Move"}
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
      >
        <p className="text-xs text-text-secondary mb-2">Move/Rename to:</p>
        <input
          autoFocus
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (operationError) {
              setOperationError(null);
            }
          }}
          className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white"
        />
      </BaseDialog>

      <Dialog.Root open={openDialog === "info"} onOpenChange={(open) => !open && closeDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[520px] z-50 p-4 focus:outline-none text-text-primary">
            <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
              File Information
            </Dialog.Title>

            {infoEntry ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-text-secondary mb-1">Name</p>
                  <p className="break-all">{infoEntry.name}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">Path</p>
                  <p className="break-all font-mono text-xs text-text-secondary">{infoEntry.path}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Type</p>
                    <p className="capitalize">{infoEntry.kind}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Hidden</p>
                    <p>{infoEntry.isHidden ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Size</p>
                    <p>
                      {infoLoading
                        ? "Calculating..."
                        : infoError
                          ? infoError
                          : formatSize(infoEntry.kind === "directory" ? infoSize : infoEntry.size) || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Modified</p>
                    <p>{formatDate(infoEntry.lastModified) || "Unknown"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No item selected.</p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={closeDialog}
                className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors"
              >
                Close
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};
