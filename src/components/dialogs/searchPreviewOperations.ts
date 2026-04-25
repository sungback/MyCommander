import type { SearchResult } from "../../hooks/useFileSystem";
import type { PanelState } from "../../types/file";
import {
  coalescePanelPath,
  isAbsolutePath,
  joinPath,
} from "../../utils/path";

export const getPanelAccessPath = (panel: PanelState) =>
  coalescePanelPath(panel.resolvedPath, panel.currentPath);

export const isSearchResultDescendantOf = (path: string, parentPath: string) =>
  path === parentPath ||
  path.startsWith(`${parentPath}/`) ||
  path.startsWith(`${parentPath}\\`);

export const collapseSearchResults = (results: SearchResult[]) =>
  results.filter(
    (candidate) =>
      !results.some(
        (other) =>
          other.path !== candidate.path &&
          other.is_dir &&
          isSearchResultDescendantOf(candidate.path, other.path)
      )
  );

export const filterRemovedSearchResults = (
  currentResults: SearchResult[],
  removedResults: SearchResult[]
) =>
  currentResults.filter(
    (result) =>
      !removedResults.some((selected) =>
        selected.is_dir
          ? isSearchResultDescendantOf(result.path, selected.path)
          : result.path === selected.path
      )
  );

export const resolveSearchOperationTarget = (
  targetInput: string,
  targetPanel: PanelState
) => {
  const trimmedTarget = targetInput.trim();
  const directTarget =
    trimmedTarget.normalize("NFC") === targetPanel.currentPath.normalize("NFC")
      ? getPanelAccessPath(targetPanel)
      : trimmedTarget;

  return isAbsolutePath(directTarget)
    ? directTarget
    : joinPath(getPanelAccessPath(targetPanel), directTarget);
};
