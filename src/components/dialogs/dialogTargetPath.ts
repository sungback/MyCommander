import { ClipboardState } from "../../store/clipboardStore";
import { DialogType, DragCopyRequest } from "../../store/dialogStore";
import { PanelState } from "../../types/file";
import {
  coalescePanelPath,
  isAbsolutePath,
  joinPath,
} from "../../utils/path";

export const getPathBaseName = (path: string) => {
  const normalized = path.replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : normalized;
};

export const getSelectedItemsText = (paths: string[]) => {
  if (paths.length === 0) return "0 files";
  if (paths.length === 1) return `"${getPathBaseName(paths[0])}"`;
  if (paths.length <= 3) {
    return paths.map((path) => `"${getPathBaseName(path)}"`).join(", ");
  }

  return `"${getPathBaseName(paths[0])}", "${getPathBaseName(paths[1])}" and ${
    paths.length - 2
  } more file(s)`;
};

export const getPanelAccessPath = (panel: PanelState) =>
  coalescePanelPath(panel.resolvedPath, panel.currentPath);

export const getDragCopyTargetPath = (
  dragCopyRequest: DragCopyRequest | null,
  leftPanel: PanelState,
  rightPanel: PanelState
) => {
  if (!dragCopyRequest) {
    return "";
  }

  if (dragCopyRequest.targetPath.trim()) {
    return dragCopyRequest.targetPath;
  }

  const targetPanel =
    dragCopyRequest.targetPanelId === "left" ? leftPanel : rightPanel;
  return getPanelAccessPath(targetPanel);
};

interface SelectedPathsArgs {
  openDialog: DialogType;
  dragCopyRequest: DragCopyRequest | null;
  isPasteMode: boolean;
  clipboard: ClipboardState | null;
  activePanel: PanelState;
}

export const getSelectedPaths = ({
  openDialog,
  dragCopyRequest,
  isPasteMode,
  clipboard,
  activePanel,
}: SelectedPathsArgs): string[] => {
  if (openDialog === "copy" && dragCopyRequest) {
    return [...dragCopyRequest.sourcePaths];
  }

  if (isPasteMode && clipboard) {
    return [...clipboard.paths];
  }

  const paths = Array.from(activePanel.selectedItems);
  if (paths.length === 0 && activePanel.files[activePanel.cursorIndex]) {
    const cursorFile = activePanel.files[activePanel.cursorIndex];
    if (cursorFile.name !== "..") {
      paths.push(cursorFile.path);
    }
  }

  return paths;
};

interface ResolveTargetPathArgs {
  inputValue: string;
  isPasteMode: boolean;
  activePanel: PanelState;
  targetPanel: PanelState;
  openDialog: DialogType;
  dragCopyRequest: DragCopyRequest | null;
  dragCopyTargetPath: string;
}

export const resolveTargetPath = ({
  inputValue,
  isPasteMode,
  activePanel,
  targetPanel,
  openDialog,
  dragCopyRequest,
  dragCopyTargetPath,
}: ResolveTargetPathArgs) => {
  const trimmedValue = inputValue.trim();
  if (!trimmedValue) {
    return "";
  }

  const basePanel = isPasteMode ? activePanel : targetPanel;
  const directPath =
    trimmedValue.normalize("NFC") === basePanel.currentPath.normalize("NFC")
      ? getPanelAccessPath(basePanel)
      : trimmedValue;
  const basePath =
    openDialog === "copy" && dragCopyRequest
      ? dragCopyTargetPath
      : getPanelAccessPath(basePanel);

  return isAbsolutePath(directPath)
    ? directPath
    : joinPath(basePath, directPath);
};
