import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import type { DialogTarget, DialogType } from "../../store/dialogStore";
import { refreshPanelsForDirectories } from "../../store/panelRefresh";
import type { PanelState } from "../../types/file";
import { getPathDirectoryName, joinPath } from "../../utils/path";
import { getPanelAccessPath } from "./dialogTargetPath";

interface UseBasicFileOperationHandlersArgs {
  activePanel: PanelState;
  dialogTarget: DialogTarget | null;
  inputValue: string;
  selectedPaths: string[];
  fs: ReturnType<typeof useFileSystem>;
  closeDialog: () => void;
  setOpenDialog: (dialog: DialogType) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
  setOperationError: (errorMessage: string | null) => void;
}

export const useBasicFileOperationHandlers = ({
  activePanel,
  dialogTarget,
  inputValue,
  selectedPaths,
  fs,
  closeDialog,
  setOpenDialog,
  setIsSubmitting,
  setOperationError,
}: UseBasicFileOperationHandlersArgs) => {
  const createInActivePanel = async (
    createEntry: (path: string) => Promise<unknown>,
    fallbackMessage: string
  ) => {
    if (!inputValue) {
      return;
    }

    const panelPath = getPanelAccessPath(activePanel);
    const fullPath = joinPath(panelPath, inputValue);

    try {
      setIsSubmitting(true);
      setOperationError(null);
      await createEntry(fullPath);
      closeDialog();
      refreshPanelsForDirectories([panelPath]);
    } catch (error) {
      console.error(error);
      setOperationError(getErrorMessage(error, fallbackMessage));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMkdir = () =>
    createInActivePanel(
      fs.createDirectory,
      "Failed to create directory."
    );

  const handleNewFile = () =>
    createInActivePanel(
      fs.createFile,
      "Failed to create file."
    );

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
    } catch (error) {
      console.error(error);
      setOperationError(
        getErrorMessage(error, "Failed to rename the selected item.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (selectedPaths.length === 0) {
      return;
    }

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
    } catch (error) {
      console.error(error);
      setOpenDialog("delete");
      setOperationError(
        getErrorMessage(error, "Failed to delete selected items.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    handleMkdir,
    handleNewFile,
    handleRename,
    handleDelete,
  };
};
