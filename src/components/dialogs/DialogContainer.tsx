import React from "react";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useClipboardStore } from "../../store/clipboardStore";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { CopyConflictDialog } from "./CopyConflictDialog";
import { TransferSpaceWarningDialog } from "./TransferSpaceWarningDialog";
import { CommandPalette } from "./palette/CommandPalette";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { FileInfoDialog } from "./FileInfoDialog";
import { QuickPreviewDialog } from "./preview/QuickPreviewDialog";
import { SettingsDialog } from "./SettingsDialog";
import { TextInputOperationDialog } from "./TextInputOperationDialog";
import { UpdateDialog } from "./UpdateDialog";
import { WildcardSelectDialog } from "./WildcardSelectDialog";
import { ChecksumDialog } from "./ChecksumDialog";
import { showTransientStatusMessage } from "../../hooks/useAppCommands";
import {
  getDragCopyTargetPath,
  getSelectedItemsText,
  getSelectedPaths,
} from "./dialogTargetPath";
import { useBasicFileOperationHandlers } from "./useBasicFileOperationHandlers";
import { useCopyMoveFlow } from "./useCopyMoveFlow";
import { useDialogInfo } from "./useDialogInfo";
import { useDialogInputState } from "./useDialogInputState";
import { useDialogPanels } from "./useDialogPanels";

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
    wildcardMode,
  } = useDialogStore();
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const updateEntrySizeEstimate = usePanelStore((s) => s.updateEntrySizeEstimate);
  const activePanelId = usePanelStore((s) => s.activePanel);
  const selectByPattern = usePanelStore((s) => s.selectByPattern);
  const invertSelection = usePanelStore((s) => s.invertSelection);
  const { leftPanel, rightPanel } = useDialogPanels(
    openDialog === null && dragCopyRequest === null
  );
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

  const { infoSize, infoSizeStatus, infoLoading, infoError } = useDialogInfo({
    openDialog,
    dialogTarget,
    infoEntry,
    updateEntrySize,
    updateEntrySizeEstimate,
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
    handlePermanentDelete,
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

  const cursorEntry = activePanel.files[activePanel.cursorIndex];
  const initialPattern = React.useMemo(() => {
    if (!cursorEntry || cursorEntry.name === ".." || cursorEntry.kind !== "file") {
      return "*.*";
    }
    const dotIndex = cursorEntry.name.lastIndexOf(".");
    if (dotIndex > 0 && dotIndex < cursorEntry.name.length - 1) {
      return `*.${cursorEntry.name.slice(dotIndex + 1)}`;
    }
    return "*.*";
  }, [cursorEntry]);

  const handleApplyWildcard = (pattern: string, mode: "select" | "unselect") => {
    const count = selectByPattern(activePanelId, pattern, mode);
    closeDialog();
    if (mode === "select") {
      showTransientStatusMessage(
        count > 0 ? `${count}개 항목이 선택되었습니다` : "일치하는 파일이 없습니다"
      );
    } else {
      showTransientStatusMessage(
        count > 0 ? `${count}개 항목이 선택 해제되었습니다` : "일치하는 파일이 없습니다"
      );
    }
  };

  const handleInvertSelection = () => {
    invertSelection(activePanelId);
    closeDialog();
    showTransientStatusMessage("선택이 반전되었습니다");
  };

  return (
    <>
      <TextInputOperationDialog
        isOpen={openDialog === "mkdir"}
        onClose={closeDialog}
        onSubmit={handleMkdir}
        title="Create New Directory"
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
        value={inputValue}
        onValueChange={updateInputValue}
      >
        <p className="text-xs text-text-secondary mb-2">
          Create directory in: {activePanel.currentPath}
        </p>
      </TextInputOperationDialog>

      <TextInputOperationDialog
        isOpen={openDialog === "newfile"}
        onClose={closeDialog}
        onSubmit={handleNewFile}
        title="Create New File"
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
        value={inputValue}
        onValueChange={updateInputValue}
      >
        <p className="text-xs text-text-secondary mb-2">
          Create file in: {activePanel.currentPath}
        </p>
      </TextInputOperationDialog>

      <TextInputOperationDialog
        isOpen={openDialog === "rename"}
        onClose={closeDialog}
        onSubmit={handleRename}
        onOpenAutoFocus={(event) => event.preventDefault()}
        title="Rename"
        submitLabel={isSubmitting ? "Renaming..." : "Rename"}
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
        inputRef={renameInputRef}
        onFocus={handleRenameInputFocus}
        value={inputValue}
        onValueChange={updateInputValue}
      >
        <p className="text-xs text-text-secondary mb-2">
          Rename item in: {dialogTarget ? dialogTarget.path : activePanel.currentPath}
        </p>
      </TextInputOperationDialog>

      <DeleteConfirmationDialog
        isOpen={openDialog === "delete"}
        onClose={closeDialog}
        onSubmit={handleDelete}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
        itemLabel={getSelectedItemsText(selectedPaths)}
      />

      <DeleteConfirmationDialog
        isOpen={openDialog === "permanentDelete"}
        onClose={closeDialog}
        onSubmit={handlePermanentDelete}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
        itemLabel={getSelectedItemsText(selectedPaths)}
        permanent
      />

      <TextInputOperationDialog
        isOpen={openDialog === "copy"}
        onClose={closeDialog}
        onSubmit={() => handleCopyMove(false)}
        title={selectedPaths.length === 1 ? `Copy 1 file` : `Copy ${selectedPaths.length} files`}
        submitLabel={isSubmitting ? "Copying..." : "Copy"}
        submitAutoFocus={false}
        isSubmitting={isSubmitting}
        errorMessage={operationError}
        value={inputValue}
        onValueChange={updateInputValue}
      >
        <div className="text-sm mb-4">
          <span className="text-text-secondary">Selected: </span>
          <span className="font-medium text-accent-color break-all">
            {getSelectedItemsText(selectedPaths)}
          </span>
        </div>
        <p className="text-xs text-text-secondary mb-2">Copy to:</p>
      </TextInputOperationDialog>

      <TextInputOperationDialog
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
        value={inputValue}
        onValueChange={updateInputValue}
      >
        <div className="text-sm mb-4">
          <span className="text-text-secondary">Selected: </span>
          <span className="font-medium text-accent-color break-all">
            {getSelectedItemsText(selectedPaths)}
          </span>
        </div>
        <p className="text-xs text-text-secondary mb-2">Move/Rename to:</p>
      </TextInputOperationDialog>

      <FileInfoDialog
        isOpen={openDialog === "info"}
        onClose={closeDialog}
        infoEntry={infoEntry}
        infoSize={infoSize}
        infoSizeStatus={infoSizeStatus}
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

      <TransferSpaceWarningDialog />

      <WildcardSelectDialog
        isOpen={openDialog === "wildcardSelect"}
        mode={wildcardMode}
        initialPattern={initialPattern}
        onClose={closeDialog}
        onSubmit={handleApplyWildcard}
        onInvert={handleInvertSelection}
      />

      <ChecksumDialog />

      <QuickPreviewDialog />
      <SettingsDialog />
      <CommandPalette />
      <UpdateDialog />
    </>
  );
};
