import { useCallback, useState } from "react";

export interface FileListDropUiState {
  isPanelHovered: boolean;
  dropTargetPath: string | null;
  isDropAllowed: boolean;
}

export const EMPTY_FILE_LIST_DROP_UI_STATE: FileListDropUiState = {
  isPanelHovered: false,
  dropTargetPath: null,
  isDropAllowed: false,
};

export const useFileListDropUiState = () => {
  const [dropUiState, setDropUiState] = useState<FileListDropUiState>(
    EMPTY_FILE_LIST_DROP_UI_STATE
  );

  const updateDropUiState = useCallback((nextState: FileListDropUiState) => {
    setDropUiState((current) => {
      if (
        current.isPanelHovered === nextState.isPanelHovered &&
        current.dropTargetPath === nextState.dropTargetPath &&
        current.isDropAllowed === nextState.isDropAllowed
      ) {
        return current;
      }

      return nextState;
    });
  }, []);

  return {
    dropUiState,
    updateDropUiState,
  };
};
