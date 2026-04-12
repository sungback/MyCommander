import { create } from "zustand";

export type DialogType =
  | "copy"
  | "move"
  | "mkdir"
  | "newfile"
  | "rename"
  | "delete"
  | "search"
  | "preview"
  | "info"
  | "sync"
  | null;

export interface DialogTarget {
  panelId: "left" | "right";
  path: string;
}

interface DialogState {
  openDialog: DialogType;
  dialogTarget: DialogTarget | null;
  setOpenDialog: (dialog: DialogType) => void;
  openRenameDialog: (target: DialogTarget) => void;
  openInfoDialog: (target: DialogTarget) => void;
  closeDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  openDialog: null,
  dialogTarget: null,
  setOpenDialog: (dialog) => set({ openDialog: dialog }),
  openRenameDialog: (dialogTarget) => set({ openDialog: "rename", dialogTarget }),
  openInfoDialog: (dialogTarget) => set({ openDialog: "info", dialogTarget }),
  closeDialog: () => set({ openDialog: null, dialogTarget: null }),
}));
