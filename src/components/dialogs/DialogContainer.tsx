import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import { useClipboardStore } from "../../store/clipboardStore";
import { useDialogStore } from "../../store/dialogStore";
import { refreshPanelsForDirectories } from "../../store/panelRefresh";
import { usePanelStore } from "../../store/panelStore";
import type { FileType } from "../../types/file";
import { getPathDirectoryName, joinPath } from "../../utils/path";
import { BaseDialog } from "./BaseDialog";
import { CopyConflictDialog } from "./CopyConflictDialog";
import { FileInfoDialog } from "./FileInfoDialog";
import { QuickPreviewDialog } from "./QuickPreviewDialog";
import { SettingsDialog } from "./SettingsDialog";
import {
  getDragCopyTargetPath,
  getPanelAccessPath,
  getPathBaseName,
  getSelectedItemsText,
  getSelectedPaths,
} from "./dialogTargetPath";
import { useCopyMoveFlow } from "./useCopyMoveFlow";
import { useDialogInfo } from "./useDialogInfo";

export const getRenameSelectionEnd = (name: string, kind: FileType = "file") => {
  if (!name) {
    return 0;
  }

  if (kind === "directory") {
    return name.length;
  }

  if (!name.includes(".")) {
    return name.length;
  }

  if (name.startsWith(".") && name.indexOf(".", 1) === -1) {
    return name.length;
  }

  const extensionIndex = name.lastIndexOf(".");
  if (extensionIndex <= 0) {
    return name.length;
  }

  return extensionIndex;
};

const selectRenameText = (input: HTMLInputElement, kind: FileType = "file") => {
  input.setSelectionRange(0, getRenameSelectionEnd(input.value, kind));
};

export const DialogContainer: React.FC = () => {
  const {
    openDialog,
    dialogTarget,
    dragCopyRequest,
    closeDialog,
    setOpenDialog,
    openDragCopyDialog,
    isPasteMode,
  } = useDialogStore();
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const activePanelId = usePanelStore((s) => s.activePanel);
  const leftPanel = usePanelStore((s) => s.leftPanel);
  const rightPanel = usePanelStore((s) => s.rightPanel);
  const clipboard = useClipboardStore((s) => s.clipboard);
  const clearClipboard = useClipboardStore((s) => s.clearClipboard);

  const fs = useFileSystem();

  const [inputValue, setInputValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const appliedRenameSelectionKeyRef = useRef<string | null>(null);
  const activePanel = activePanelId === "left" ? leftPanel : rightPanel;
  const targetPanel = activePanelId === "left" ? rightPanel : leftPanel;
  const dragCopyTargetPath = getDragCopyTargetPath(
    dragCopyRequest,
    leftPanel,
    rightPanel
  );
  const infoPanel = dialogTarget?.panelId === "left" ? leftPanel : rightPanel;
  const infoEntry = dialogTarget?.entry ?? (dialogTarget
    ? infoPanel.files.find(
        (entry) =>
          entry.path.normalize("NFC") === dialogTarget.path.normalize("NFC")
      ) ?? null
    : null);
  const selectedPaths = getSelectedPaths({
    openDialog,
    dragCopyRequest,
    isPasteMode,
    clipboard,
    activePanel,
  });

  const { infoSize, infoLoading, infoError } = useDialogInfo({
    openDialog,
    dialogTarget,
    infoEntry,
    updateEntrySize,
    fs,
  });

  const {
    operationError,
    setOperationError,
    isSubmitting,
    setIsSubmitting,
    conflictFiles,
    handleCopyMove,
    handleOverwriteAll,
    handleSkipExisting,
    clearConflictState,
  } = useCopyMoveFlow({
    openDialog,
    dragCopyRequest,
    dragCopyTargetPath,
    isPasteMode,
    activePanel,
    targetPanel,
    clipboard,
    clearClipboard,
    selectedPaths,
    inputValue,
    fs,
    setOpenDialog,
    openDragCopyDialog,
    closeDialog,
  });

  useLayoutEffect(() => {
    if (openDialog === "copy" && dragCopyRequest) {
      setInputValue(dragCopyTargetPath);
    } else if (openDialog === "copy" || openDialog === "move") {
      setInputValue(isPasteMode ? activePanel.currentPath : targetPanel.currentPath);
    } else if (openDialog === "mkdir" || openDialog === "newfile") {
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
    dragCopyTargetPath,
    isPasteMode,
    openDialog,
    targetPanel.currentPath,
  ]);

  useEffect(() => {
    if (openDialog !== "rename" || !dialogTarget) {
      appliedRenameSelectionKeyRef.current = null;
    }
  }, [openDialog, dialogTarget]);

  useEffect(() => {
    if (openDialog !== "rename" || !dialogTarget || inputValue !== getPathBaseName(dialogTarget.path)) {
      return;
    }

    const input = renameInputRef.current;
    if (!input) {
      return;
    }

    const selectionKey = dialogTarget.path;
    const timeoutId = window.setTimeout(() => {
      selectRenameText(input, dialogTarget.entry?.kind);
      appliedRenameSelectionKeyRef.current = selectionKey;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [dialogTarget, inputValue, openDialog]);

  const updateInputValue = (value: string) => {
    setInputValue(value);
    if (operationError) {
      setOperationError(null);
    }
  };

  const handleMkdir = async () => {
    if (!inputValue) return;
    try {
      setIsSubmitting(true);
      setOperationError(null);
      const fullPath = joinPath(getPanelAccessPath(activePanel), inputValue);
      await fs.createDirectory(fullPath);
      closeDialog();
      refreshPanelsForDirectories([getPanelAccessPath(activePanel)]);
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
      const fullPath = joinPath(getPanelAccessPath(activePanel), inputValue);
      await fs.createFile(fullPath);
      closeDialog();
      refreshPanelsForDirectories([getPanelAccessPath(activePanel)]);
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
    const deleteTargets = [...selectedPaths];
    try {
      setIsSubmitting(true);
      setOperationError(null);
      await fs.submitJob({
        kind: "delete",
        paths: deleteTargets,
        permanent: false,
      });
      setOpenDialog("progress");
    } catch (e) {
      console.error(e);
      setOpenDialog("delete");
      setOperationError(getErrorMessage(e, "Failed to delete selected items."));
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
        <p className="text-xs text-text-secondary mb-2">
          Create directory in: {activePanel.currentPath}
        </p>
        <input
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={inputValue}
          onChange={(e) => updateInputValue(e.target.value)}
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
        <p className="text-xs text-text-secondary mb-2">
          Create file in: {activePanel.currentPath}
        </p>
        <input
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={inputValue}
          onChange={(e) => updateInputValue(e.target.value)}
          className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white"
        />
      </BaseDialog>

      <BaseDialog
        isOpen={openDialog === "rename"}
        onClose={closeDialog}
        onSubmit={handleRename}
        onOpenAutoFocus={(event) => event.preventDefault()}
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
          ref={renameInputRef}
          onFocus={(e) => {
            if (appliedRenameSelectionKeyRef.current !== dialogTarget?.path) {
              selectRenameText(e.target, dialogTarget?.entry?.kind);
              appliedRenameSelectionKeyRef.current = dialogTarget?.path ?? null;
            }
          }}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={inputValue}
          onChange={(e) => updateInputValue(e.target.value)}
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
          Do you really want to delete{" "}
          <span className="font-semibold text-accent-color break-all">
            {getSelectedItemsText(selectedPaths)}
          </span>
          ?
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
          <span className="font-medium text-accent-color break-all">
            {getSelectedItemsText(selectedPaths)}
          </span>
        </div>
        <p className="text-xs text-text-secondary mb-2">Copy to:</p>
        <input
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={inputValue}
          onChange={(e) => updateInputValue(e.target.value)}
          className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white"
        />
      </BaseDialog>

      <BaseDialog
        isOpen={openDialog === "move"}
        onClose={closeDialog}
        onSubmit={() => handleCopyMove(true)}
        title={
          selectedPaths.length === 1
            ? `Move/Rename 1 file`
            : `Move/Rename ${selectedPaths.length} files`
        }
        submitLabel={isSubmitting ? "Moving..." : "Move"}
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
      >
        <div className="text-sm mb-4">
          <span className="text-text-secondary">Selected: </span>
          <span className="font-medium text-accent-color break-all">
            {getSelectedItemsText(selectedPaths)}
          </span>
        </div>
        <p className="text-xs text-text-secondary mb-2">Move/Rename to:</p>
        <input
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={inputValue}
          onChange={(e) => updateInputValue(e.target.value)}
          className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white"
        />
      </BaseDialog>

      <FileInfoDialog
        isOpen={openDialog === "info"}
        onClose={closeDialog}
        infoEntry={infoEntry}
        infoSize={infoSize}
        infoLoading={infoLoading}
        infoError={infoError}
      />

      <CopyConflictDialog
        isOpen={conflictFiles.length > 0}
        conflictFiles={conflictFiles}
        isSubmitting={isSubmitting}
        onClose={clearConflictState}
        onSkipExisting={handleSkipExisting}
        onOverwriteAll={handleOverwriteAll}
      />

      <QuickPreviewDialog />
      <SettingsDialog />
    </>
  );
};
