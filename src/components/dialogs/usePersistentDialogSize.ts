import { useState } from "react";

export interface DialogSize {
  width: number;
  height: number;
}

const readStoredDialogSize = (
  storageKey: string,
  defaultSize: DialogSize
): DialogSize => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved) as DialogSize;
    }
  } catch {
    // ignore storage parse failure
  }

  return defaultSize;
};

export const usePersistentDialogSize = (
  storageKey: string,
  defaultSize: DialogSize
) => {
  const [dialogSize, setDialogSize] = useState<DialogSize>(() =>
    readStoredDialogSize(storageKey, defaultSize)
  );

  const resizeDialog = (delta: DialogSize) => {
    const newSize = {
      width: dialogSize.width + delta.width,
      height: dialogSize.height + delta.height,
    };
    setDialogSize(newSize);

    try {
      localStorage.setItem(storageKey, JSON.stringify(newSize));
    } catch {
      // ignore storage failure
    }
  };

  return {
    dialogSize,
    resizeDialog,
  };
};
