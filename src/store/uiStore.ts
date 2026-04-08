import { create } from "zustand";

interface UiState {
  statusMessage: string | null;
  setStatusMessage: (message: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  statusMessage: null,
  setStatusMessage: (statusMessage) => set({ statusMessage }),
}));
