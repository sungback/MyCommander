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
  | "jobcenter"
  | "settings"
  | null;

export interface DialogTarget {
  panelId: "left" | "right";
  path: string;
}

export interface DragCopyRequest {
  sourcePanelId: "left" | "right";
  targetPanelId: "left" | "right";
  sourcePaths: string[];
  targetPath: string;
}

interface DialogState {
  openDialog: DialogType;
  dialogTarget: DialogTarget | null;
  dragCopyRequest: DragCopyRequest | null;
  multiRenameSession: MultiRenameSession | null;
  isPasteMode: boolean;
  setOpenDialog: (dialog: DialogType) => void;
  openRenameDialog: (target: DialogTarget) => void;
  openInfoDialog: (target: DialogTarget) => void;
  openMultiRenameDialog: (session: MultiRenameSession) => void;
  openPreviewDialog: (target: DialogTarget) => void;
  openDragCopyDialog: (request: DragCopyRequest) => void;
  openPasteDialog: (dialog: "copy" | "move") => void;
  closeDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  openDialog: null,
  dialogTarget: null,
  dragCopyRequest: null,
  multiRenameSession: null,
  isPasteMode: false,
  setOpenDialog: (dialog) =>
    set({
      openDialog: dialog,
      dialogTarget: null,
      dragCopyRequest: null,
      multiRenameSession: null,
      isPasteMode: false,
    }),
  openRenameDialog: (dialogTarget) =>
    set({ openDialog: "rename", dialogTarget, dragCopyRequest: null, isPasteMode: false }),
  openInfoDialog: (dialogTarget) =>
    set({ openDialog: "info", dialogTarget, dragCopyRequest: null, isPasteMode: false }),
  openPreviewDialog: (dialogTarget) =>
    set({ openDialog: "preview", dialogTarget, dragCopyRequest: null, isPasteMode: false }),
  openMultiRenameDialog: (multiRenameSession) =>
    set({ openDialog: "multirename", multiRenameSession, dragCopyRequest: null, isPasteMode: false }),
  openDragCopyDialog: (dragCopyRequest) =>
    set({
      openDialog: "copy",
      dialogTarget: null,
      dragCopyRequest,
      multiRenameSession: null,
      isPasteMode: false,
    }),
  openPasteDialog: (dialog) =>
    set({
      openDialog: dialog,
      dialogTarget: null,
      dragCopyRequest: null,
      multiRenameSession: null,
      isPasteMode: true,
    }),
  closeDialog: () =>
    set({
      openDialog: null,
      dialogTarget: null,
      dragCopyRequest: null,
      multiRenameSession: null,
      isPasteMode: false,
    }),
}));
