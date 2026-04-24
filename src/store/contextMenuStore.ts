import { create } from "zustand";
import { FileEntry } from "../types/file";

interface ContextMenuState {
  isOpen: boolean;
  panelId: "left" | "right" | null;
  targetPath: string | null;
  targetEntry: FileEntry | null;
  x: number;
  y: number;
  openContextMenu: (payload: {
    panelId: "left" | "right";
    targetPath?: string | null;
    targetEntry?: FileEntry | null;
    x: number;
    y: number;
  }) => void;
  closeContextMenu: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  panelId: null,
  targetPath: null,
  targetEntry: null,
  x: 0,
  y: 0,
  openContextMenu: ({ panelId, targetPath = null, targetEntry = null, x, y }) =>
    set({
      isOpen: true,
      panelId,
      targetPath,
      targetEntry,
      x,
      y,
    }),
  closeContextMenu: () =>
    set({
      isOpen: false,
      panelId: null,
      targetPath: null,
      targetEntry: null,
    }),
}));
