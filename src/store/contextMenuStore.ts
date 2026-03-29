import { create } from "zustand";

interface ContextMenuState {
  isOpen: boolean;
  panelId: "left" | "right" | null;
  targetPath: string | null;
  x: number;
  y: number;
  openContextMenu: (payload: {
    panelId: "left" | "right";
    targetPath?: string | null;
    x: number;
    y: number;
  }) => void;
  closeContextMenu: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  panelId: null,
  targetPath: null,
  x: 0,
  y: 0,
  openContextMenu: ({ panelId, targetPath = null, x, y }) =>
    set({
      isOpen: true,
      panelId,
      targetPath,
      x,
      y,
    }),
  closeContextMenu: () =>
    set({
      isOpen: false,
      panelId: null,
      targetPath: null,
    }),
}));
