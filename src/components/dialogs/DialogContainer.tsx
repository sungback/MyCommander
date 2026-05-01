import React from "react";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useClipboardStore } from "../../store/clipboardStore";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { BaseDialog } from "./BaseDialog";
import { CopyConflictDialog } from "./CopyConflictDialog";
import { FileInfoDialog } from "./FileInfoDialog";
import { QuickPreviewDialog } from "./QuickPreviewDialog";
import { SettingsDialog } from "./SettingsDialog";
import {
  getDragCopyTargetPath,
  getSelectedItemsText,
  getSelectedPaths,
} from "./dialogTargetPath";
import { useBasicFileOperationHandlers } from "./useBasicFileOperationHandlers";
import { useCopyMoveFlow } from "./useCopyMoveFlow";
import { useDialogInfo } from "./useDialogInfo";
import { useDialogInputState } from "./useDialogInputState";

export { getRenameSelectionEnd } from "./useDialogInputState";

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
    inputValue,
    setInputValue,
    renameInputRef,
    handleRenameInputFocus,
  } = useDialogInputState({
    openDialog,
    dialogTarget,
    dragCopyRequest,
    dragCopyTargetPath,
    isPasteMode,
    activePanel,
    targetPanel,
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

  const updateInputValue = (value: string) => {
    setInputValue(value);
    if (operationError) {
      setOperationError(null);
    }
  };

  const {
    handleMkdir,
    handleNewFile,
    handleRename,
    handleDelete,
  } = useBasicFileOperationHandlers({
    activePanel,
    dialogTarget,
    inputValue,
    selectedPaths,
    fs,
    closeDialog,
    setOpenDialog,
    setIsSubmitting,
    setOperationError,
  });

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
          onFocus={(e) => handleRenameInputFocus(e.target)}
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
