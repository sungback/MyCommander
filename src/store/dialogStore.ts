import { create } from "zustand";
import { MultiRenameSession } from "../features/multiRename";

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
  | "multirename"
  | "progress"
  | null;

export interface DialogTarget {
  panelId: "left" | "right";
  path: string;
}

interface DialogState {
  openDialog: DialogType;
  dialogTarget: DialogTarget | null;
  multiRenameSession: MultiRenameSession | null;
  setOpenDialog: (dialog: DialogType) => void;
  openRenameDialog: (target: DialogTarget) => void;
  openInfoDialog: (target: DialogTarget) => void;
  openMultiRenameDialog: (session: MultiRenameSession) => void;
  closeDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  openDialog: null,
  dialogTarget: null,
  multiRenameSession: null,
  setOpenDialog: (dialog) => set({ openDialog: dialog }),
  openRenameDialog: (dialogTarget) => set({ openDialog: "rename", dialogTarget }),
  openInfoDialog: (dialogTarget) => set({ openDialog: "info", dialogTarget }),
  openMultiRenameDialog: (multiRenameSession) =>
    set({ openDialog: "multirename", multiRenameSession }),
  closeDialog: () => set({ openDialog: null, dialogTarget: null, multiRenameSession: null }),
}));
