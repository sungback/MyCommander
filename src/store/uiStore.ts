import { create } from "zustand";

interface UiState {
  showFavoritesPanel: boolean;
  toggleFavoritesPanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  showFavoritesPanel: true,
  toggleFavoritesPanel: () =>
    set((state) => ({ showFavoritesPanel: !state.showFavoritesPanel })),
}));
