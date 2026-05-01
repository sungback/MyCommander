import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  DialogTarget,
  DialogType,
  DragCopyRequest,
} from "../../store/dialogStore";
import type { FileType, PanelState } from "../../types/file";
import { getPathBaseName } from "./dialogTargetPath";

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

interface UseDialogInputStateArgs {
  openDialog: DialogType;
  dialogTarget: DialogTarget | null;
  dragCopyRequest: DragCopyRequest | null;
  dragCopyTargetPath: string;
  isPasteMode: boolean;
  activePanel: PanelState;
  targetPanel: PanelState;
}

export const useDialogInputState = ({
  openDialog,
  dialogTarget,
  dragCopyRequest,
  dragCopyTargetPath,
  isPasteMode,
  activePanel,
  targetPanel,
}: UseDialogInputStateArgs) => {
  const [inputValue, setInputValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const appliedRenameSelectionKeyRef = useRef<string | null>(null);

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
    if (
      openDialog !== "rename" ||
      !dialogTarget ||
      inputValue !== getPathBaseName(dialogTarget.path)
    ) {
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

  const handleRenameInputFocus = (input: HTMLInputElement) => {
    if (appliedRenameSelectionKeyRef.current !== dialogTarget?.path) {
      selectRenameText(input, dialogTarget?.entry?.kind);
      appliedRenameSelectionKeyRef.current = dialogTarget?.path ?? null;
    }
  };

  return {
    inputValue,
    setInputValue,
    renameInputRef,
    handleRenameInputFocus,
  };
};
