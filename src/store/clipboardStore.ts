import { create } from "zustand";
import { PanelId } from "../types/file";

export interface ClipboardState {
  paths: string[];
  operation: "copy" | "cut";
  sourcePanel: PanelId;
}

interface ClipboardStore {
  clipboard: ClipboardState | null;
  setClipboard: (state: ClipboardState) => void;
  clearClipboard: () => void;
}

export const useClipboardStore = create<ClipboardStore>((set) => ({
  clipboard: null,
  setClipboard: (state) => set({ clipboard: state }),
  clearClipboard: () => set({ clipboard: null }),
}));
