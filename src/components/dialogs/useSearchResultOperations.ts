import { useCallback, useState } from "react";
import {
  getErrorMessage,
  type SearchResult,
  useFileSystem,
} from "../../hooks/useFileSystem";
import {
  refreshPanelsForDirectories,
  refreshPanelsForEntryPaths,
} from "../../store/panelRefresh";
import type { PanelState } from "../../types/file";
import { getPathDirectoryName } from "../../utils/path";
import type { SearchOperation } from "./SearchOperationDialog";
import {
  collapseSearchResults,
  resolveSearchOperationTarget,
} from "./searchPreviewOperations";

const formatCopyConflictError = (conflicts: string[]) => {
  const preview = conflicts.slice(0, 3).join(", ");
  const suffix = conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : "";
  return `Copy target has conflicting item name(s): ${preview}${suffix}`;
};

interface UseSearchResultOperationsArgs {
  selectedCount: number;
  getSelectedSearchResults: () => SearchResult[];
  clearSearchSelection: () => void;
  removeResultsFromList: (removedResults: SearchResult[]) => void;
  targetPanel: PanelState;
  fs: ReturnType<typeof useFileSystem>;
  setSearchError: (error: string | null) => void;
}

export const useSearchResultOperations = ({
  selectedCount,
  getSelectedSearchResults,
  clearSearchSelection,
  removeResultsFromList,
  targetPanel,
  fs,
  setSearchError,
}: UseSearchResultOperationsArgs) => {
  const [isDeletingSearchResults, setIsDeletingSearchResults] = useState(false);
  const [searchOperation, setSearchOperation] = useState<SearchOperation | null>(
    null
  );
  const [searchOperationTarget, setSearchOperationTarget] = useState("");
  const [isApplyingSearchOperation, setIsApplyingSearchOperation] =
    useState(false);
  const [searchOperationError, setSearchOperationError] = useState<string | null>(
    null
  );

  const resetSearchOperation = useCallback(() => {
    setSearchOperation(null);
    setSearchOperationTarget("");
    setSearchOperationError(null);
  }, []);

  const openSearchOperationDialog = (operation: SearchOperation) => {
    if (selectedCount === 0) {
      return;
    }

    setSearchOperation(operation);
    setSearchOperationTarget(targetPanel.currentPath);
    setSearchOperationError(null);
  };

  const closeSearchOperationDialog = () => {
    if (isApplyingSearchOperation) {
      return;
    }

    resetSearchOperation();
  };

  const handleDeleteSearchResults = async () => {
    const selectedResults = collapseSearchResults(getSelectedSearchResults());

    if (selectedResults.length === 0) {
      return;
    }

    try {
      setIsDeletingSearchResults(true);
      setSearchError(null);
      await fs.deleteFiles(
        selectedResults.map((result) => result.path),
        false
      );

      removeResultsFromList(selectedResults);
      clearSearchSelection();
      refreshPanelsForEntryPaths(selectedResults.map((result) => result.path));
    } catch (error) {
      console.error(error);
      setSearchError(
        getErrorMessage(error, "Failed to delete selected search results.")
      );
    } finally {
      setIsDeletingSearchResults(false);
    }
  };

  const handleSearchOperation = async () => {
    if (!searchOperation) {
      return;
    }

    const selectedResults = collapseSearchResults(getSelectedSearchResults());
    const trimmedTarget = searchOperationTarget.trim();
    if (selectedResults.length === 0 || !trimmedTarget) {
      return;
    }

    const resolvedTarget = resolveSearchOperationTarget(
      trimmedTarget,
      targetPanel
    );

    try {
      setIsApplyingSearchOperation(true);
      setSearchOperationError(null);

      const selectedPaths = selectedResults.map((result) => result.path);

      if (searchOperation === "copy") {
        const conflicts = await fs.checkCopyConflicts(selectedPaths, resolvedTarget);
        if (conflicts.length > 0) {
          setSearchOperationError(formatCopyConflictError(conflicts));
          return;
        }

        await fs.copyFiles(selectedPaths, resolvedTarget);
      } else {
        await fs.moveFiles(selectedPaths, resolvedTarget);
        removeResultsFromList(selectedResults);
        clearSearchSelection();
      }

      refreshPanelsForDirectories([
        resolvedTarget,
        ...selectedResults.map((result) => getPathDirectoryName(result.path)),
      ]);
      resetSearchOperation();
    } catch (error) {
      console.error(error);
      setSearchOperationError(
        getErrorMessage(
          error,
          searchOperation === "copy"
            ? "Failed to copy selected search results."
            : "Failed to move selected search results."
        )
      );
    } finally {
      setIsApplyingSearchOperation(false);
    }
  };

  const updateSearchOperationTarget = (target: string) => {
    setSearchOperationTarget(target);
    if (searchOperationError) {
      setSearchOperationError(null);
    }
  };

  return {
    isDeletingSearchResults,
    searchOperation,
    searchOperationTarget,
    isApplyingSearchOperation,
    searchOperationError,
    resetSearchOperation,
    openSearchOperationDialog,
    closeSearchOperationDialog,
    handleDeleteSearchResults,
    handleSearchOperation,
    updateSearchOperationTarget,
  };
};
