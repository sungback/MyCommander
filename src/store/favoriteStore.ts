import { create } from "zustand";

export interface Favorite {
  id: string;
  name: string;
  path: string;
  order: number;
}

interface FavoriteState {
  favorites: Favorite[];
  addFavorite: (path: string, name?: string) => void;
  removeFavorite: (id: string) => void;
  renameFavorite: (id: string, name: string) => void;
  reorderFavorites: (dragId: string, dropId: string) => void;
}

const FAVORITES_STORAGE_KEY = "total-commander:favorites";

const readFavorites = (): Favorite[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Favorite =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.path === "string" &&
        typeof item.order === "number"
    );
  } catch {
    return [];
  }
};

const writeFavorites = (favorites: Favorite[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // ignore storage errors
  }
};

const createId = () =>
  `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const useFavoriteStore = create<FavoriteState>((set) => ({
  favorites: readFavorites(),

  addFavorite: (path, name) =>
    set((state) => {
      if (state.favorites.some((f) => f.path === path)) return state;
      const folderName =
        name ?? path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
      const newFav: Favorite = {
        id: createId(),
        name: folderName,
        path,
        order: state.favorites.length,
      };
      const next = [...state.favorites, newFav];
      writeFavorites(next);
      return { favorites: next };
    }),

  removeFavorite: (id) =>
    set((state) => {
      const next = state.favorites
        .filter((f) => f.id !== id)
        .map((f, i) => ({ ...f, order: i }));
      writeFavorites(next);
      return { favorites: next };
    }),

  renameFavorite: (id, name) =>
    set((state) => {
      const next = state.favorites.map((f) =>
        f.id === id ? { ...f, name } : f
      );
      writeFavorites(next);
      return { favorites: next };
    }),

  reorderFavorites: (dragId, dropId) =>
    set((state) => {
      if (dragId === dropId) return state;
      const dragIndex = state.favorites.findIndex((f) => f.id === dragId);
      const dropIndex = state.favorites.findIndex((f) => f.id === dropId);
      if (dragIndex === -1 || dropIndex === -1) return state;
      const next = [...state.favorites];
      const [dragged] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, dragged);
      const reordered = next.map((f, i) => ({ ...f, order: i }));
      writeFavorites(reordered);
      return { favorites: reordered };
    }),
}));
