import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { refreshPanelsForDirectories } from "../../store/panelRefresh";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import { getPathDirectoryName, isAbsolutePath, joinPath } from "../../utils/path";
import { formatDate, formatSize } from "../../utils/format";
import { QuickPreviewDialog } from "./QuickPreviewDialog";
import { showTransientStatusMessage } from "../../hooks/useAppCommands";
import { SettingsDialog } from "./SettingsDialog";

const getPathBaseName = (path: string) => {
  const normalized = path.replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : normalized;
};

const getSelectedItemsText = (paths: string[]) => {
  if (paths.length === 0) return "0 files";
  if (paths.length === 1) return `"${getPathBaseName(paths[0])}"`;
  if (paths.length <= 3) return paths.map((p) => `"${getPathBaseName(p)}"`).join(", ");
  return `"${getPathBaseName(paths[0])}", "${getPathBaseName(paths[1])}" and ${paths.length - 2} more file(s)`;
};

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
  const {
    openDialog,
    dialogTarget,
    dragCopyRequest,
    closeDialog,
    setOpenDialog,
    isPasteMode,
  } = useDialogStore();
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const activePanelId = usePanelStore((s) => s.activePanel);
  const leftPanel = usePanelStore((s) => s.leftPanel);
  const rightPanel = usePanelStore((s) => s.rightPanel);
  const clipboard = usePanelStore((s) => s.clipboard);
  const clearClipboard = usePanelStore((s) => s.clearClipboard);

  const fs = useFileSystem();

  // Dialog-specific state
  const [inputValue, setInputValue] = useState("");
  const [infoSize, setInfoSize] = useState<number | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictFiles, setConflictFiles] = useState<string[]>([]);
  const [pendingCopy, setPendingCopy] = useState<{
    isMove: boolean;
    allPaths: string[];
    targetPath: string;
  } | null>(null);

  const activePanel = activePanelId === "left" ? leftPanel : rightPanel;
  const targetPanel = activePanelId === "left" ? rightPanel : leftPanel;
  const dragSourcePanel =
    dragCopyRequest?.sourcePanelId === "left" ? leftPanel : rightPanel;
  const infoPanel = dialogTarget?.panelId === "left" ? leftPanel : rightPanel;
  const infoEntry = dialogTarget
    ? infoPanel.files.find((entry) => entry.path.normalize("NFC") === dialogTarget.path.normalize("NFC")) ?? null
    : null;

  // Paste 모드: 클립보드 경로 사용 / 일반 모드: 현재 선택 또는 커서 사용
  const selectedPaths: string[] =
    openDialog === "copy" && dragCopyRequest
      ? [...dragCopyRequest.sourcePaths]
      : isPasteMode && clipboard
        ? [...clipboard.paths]
        : (() => {
          const paths = Array.from(activePanel.selectedItems);
          if (paths.length === 0 && activePanel.files[activePanel.cursorIndex]) {
            const cursorFile = activePanel.files[activePanel.cursorIndex];
            if (cursorFile.name !== "..") paths.push(cursorFile.path);
          }
          return paths;
        })();

  // Effect to set default input values when dialog opens
  useEffect(() => {
    if (openDialog === "copy" && dragCopyRequest) {
      setInputValue(dragCopyRequest.targetPath);
    } else if (openDialog === "copy" || openDialog === "move") {
      // paste 모드: 목적지는 현재 활성 패널(붙여넣기 위치)
      // 일반 모드: 목적지는 반대 패널
      setInputValue(isPasteMode ? activePanel.currentPath : targetPanel.currentPath);
    } else if (openDialog === "mkdir") {
      setInputValue("");
    } else if (openDialog === "newfile") {
      setInputValue("");
    } else if (openDialog === "rename" && dialogTarget) {
      setInputValue(getPathBaseName(dialogTarget.path));
    } else {
      setInputValue("");
    }
  }, [
    activePanel.currentPath,
    dialogTarget,
    dragCopyRequest,
    isPasteMode,
    openDialog,
    targetPanel.currentPath,
  ]);

  useEffect(() => {
    setOperationError(null);
    setIsSubmitting(false);
    setConflictFiles([]);
    setPendingCopy(null);
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
      refreshPanelsForDirectories([activePanel.currentPath]);
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
      refreshPanelsForDirectories([activePanel.currentPath]);
    } catch (e) {
      console.error(e);
      setOperationError(getErrorMessage(e, "Failed to create file."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRename = async () => {
    if (!dialogTarget || !inputValue.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setOperationError(null);
      const sourcePath = dialogTarget.path;
      const targetName = inputValue.trim();
      const parentPath = getPathDirectoryName(sourcePath);
      const fullPath = parentPath ? joinPath(parentPath, targetName) : targetName;
      await fs.renameFile(sourcePath, fullPath);
      closeDialog();
      refreshPanelsForDirectories([parentPath]);
    } catch (e) {
      console.error(e);
      setOperationError(getErrorMessage(e, "Failed to rename the selected item."));
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
      refreshPanelsForDirectories([activePanel.currentPath]);
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

    const basePath =
      openDialog === "copy" && dragCopyRequest
        ? dragCopyRequest.targetPath
        : (isPasteMode ? activePanel : targetPanel).currentPath;
    return isAbsolutePath(trimmedValue)
      ? trimmedValue
      : joinPath(basePath, trimmedValue);
  };

  const executeCopyMove = async (
    isMove: boolean,
    paths: string[],
    targetPath: string,
    keepBoth: boolean = false
  ) => {
    setOpenDialog("progress");
    try {
      if (isMove) {
        await fs.moveFiles(paths, targetPath);
      } else {
        const savedNames = await fs.copyFiles(paths, targetPath, keepBoth);

        // keep_both 모드에서 이름이 바뀐 파일이 있으면 안내
        if (keepBoth && savedNames.length > 0) {
          const origNames = paths.map((p) => p.split(/[\\/]/).pop() ?? "");
          const renamed = savedNames.filter((saved, i) => saved !== origNames[i]);
          if (renamed.length > 0) {
            const preview =
              renamed.length === 1
                ? `'${renamed[0]}'`
                : `'${renamed[0]}' 외 ${renamed.length - 1}개`;
            showTransientStatusMessage(
              `${renamed.length}개 파일이 이미 존재하여 ${preview}(으)로 저장됨`,
              3000
            );
          }
        }
      }
      // cut 작업이 완료되면 클립보드 초기화
      if (isPasteMode && clipboard?.operation === "cut") {
        clearClipboard();
        if (!keepBoth) showTransientStatusMessage(`${paths.length}개 항목 이동됨`);
      }
      closeDialog();
      refreshPanelsForDirectories([
        (openDialog === "copy" && dragCopyRequest ? dragSourcePanel : activePanel).currentPath,
        targetPath,
      ]);
    } catch (e) {
      console.error(e);
      // Switch back to the form dialog so the error message can be displayed
      setOpenDialog(isMove ? "move" : "copy");
      throw e;
    }
  };

  const handleCopyMove = async (isMove: boolean) => {
    if (!inputValue || selectedPaths.length === 0) return;
    try {
      setIsSubmitting(true);
      setOperationError(null);
      const targetPath = resolveTargetPath();

      // Check for conflicts
      const conflicts = await fs.checkCopyConflicts(selectedPaths, targetPath);
      if (conflicts.length > 0) {
        // paste 모드(Cmd+V): 덮어쓰기 다이얼로그 없이 자동으로 "copy" 이름으로 저장
        if (isPasteMode && !isMove) {
          await executeCopyMove(false, selectedPaths, targetPath, true);
          return;
        }
        // 일반 모드(F5/F6): 기존 덮어쓰기 확인 다이얼로그 표시
        setConflictFiles(conflicts);
        setPendingCopy({ isMove, allPaths: selectedPaths, targetPath });
        setIsSubmitting(false);
        return;
      }

      // No conflicts, proceed with copy/move
      await executeCopyMove(isMove, selectedPaths, targetPath);
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
      setIsSubmitting(false);
    }
  };

  const handleOverwriteAll = async () => {
    if (!pendingCopy) return;
    try {
      setIsSubmitting(true);
      await executeCopyMove(pendingCopy.isMove, pendingCopy.allPaths, pendingCopy.targetPath);
    } catch (e) {
      console.error(e);
      setOperationError(
        getErrorMessage(
          e,
          pendingCopy.isMove
            ? "Failed to move selected items."
            : "Failed to copy selected items."
        )
      );
    } finally {
      setIsSubmitting(false);
      setConflictFiles([]);
      setPendingCopy(null);
    }
  };

  const handleSkipExisting = async () => {
    if (!pendingCopy) return;
    try {
      setIsSubmitting(true);
      const nonConflicting = pendingCopy.allPaths.filter((p) => {
        const baseName = p.split(/[\\/]/).pop() || "";
        return !conflictFiles.includes(baseName);
      });
      if (nonConflicting.length > 0) {
        await executeCopyMove(pendingCopy.isMove, nonConflicting, pendingCopy.targetPath);
      } else {
        closeDialog();
      }
    } catch (e) {
      console.error(e);
      setOperationError(
        getErrorMessage(
          e,
          pendingCopy.isMove
            ? "Failed to move selected items."
            : "Failed to copy selected items."
        )
      );
    } finally {
      setIsSubmitting(false);
      setConflictFiles([]);
      setPendingCopy(null);
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
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
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
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
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
        isOpen={openDialog === "rename"}
        onClose={closeDialog}
        onSubmit={handleRename}
        title="Rename"
        submitLabel={isSubmitting ? "Renaming..." : "Rename"}
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
      >
        <p className="text-xs text-text-secondary mb-2">
          Rename item in: {dialogTarget ? dialogTarget.path : activePanel.currentPath}
        </p>
        <input
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
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
          Do you really want to delete <span className="font-semibold text-accent-color break-all">{getSelectedItemsText(selectedPaths)}</span>?
        </p>
      </BaseDialog>

      <BaseDialog
        isOpen={openDialog === "copy"}
        onClose={closeDialog}
        onSubmit={() => handleCopyMove(false)}
        title={selectedPaths.length === 1 ? `Copy 1 file` : `Copy ${selectedPaths.length} files`}
        submitLabel={isSubmitting ? "Copying..." : "Copy"}
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
      >
        <div className="text-sm mb-4">
          <span className="text-text-secondary">Selected: </span>
          <span className="font-medium text-accent-color break-all">{getSelectedItemsText(selectedPaths)}</span>
        </div>
        <p className="text-xs text-text-secondary mb-2">Copy to:</p>
        <input
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
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
        title={selectedPaths.length === 1 ? `Move/Rename 1 file` : `Move/Rename ${selectedPaths.length} files`}
        submitLabel={isSubmitting ? "Moving..." : "Move"}
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
      >
        <div className="text-sm mb-4">
          <span className="text-text-secondary">Selected: </span>
          <span className="font-medium text-accent-color break-all">{getSelectedItemsText(selectedPaths)}</span>
        </div>
        <p className="text-xs text-text-secondary mb-2">Move/Rename to:</p>
        <input
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
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

      {/* Overwrite confirmation dialog */}
      <Dialog.Root
        open={conflictFiles.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setConflictFiles([]);
            setPendingCopy(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[450px] z-50 p-4 text-text-primary">
            <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
              Files Already Exist
            </Dialog.Title>
            <div className="mb-6 space-y-3">
              <p className="text-sm">
                The following {conflictFiles.length} item(s) already exist in the destination:
              </p>
              <ul className="max-h-40 overflow-y-auto space-y-1">
                {conflictFiles.map((name) => (
                  <li
                    key={name}
                    className="text-xs font-mono text-text-secondary truncate px-2 py-0.5 bg-bg-secondary rounded"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConflictFiles([]);
                  setPendingCopy(null);
                }}
                disabled={isSubmitting}
                className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSkipExisting}
                disabled={isSubmitting}
                className="px-4 py-1.5 min-w-[100px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Skipping..." : "Skip Existing"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleOverwriteAll}
                disabled={isSubmitting}
                className="px-4 py-1.5 min-w-[100px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Overwriting..." : "Overwrite All"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <QuickPreviewDialog />
      <SettingsDialog />
    </>
  );
};
