import { create } from "zustand";
import { PanelId } from "../types/file";

export interface DragInfo {
  paths: string[];
  directoryPaths: string[];
  sourcePanel: PanelId;
}

interface DragStore {
  dragInfo: DragInfo | null;
  setDragInfo: (info: DragInfo | null) => void;
}

export const useDragStore = create<DragStore>((set) => ({
  dragInfo: null,
  setDragInfo: (info) => set({ dragInfo: info }),
}));
