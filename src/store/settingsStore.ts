import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  resolvePersistedFontFamily,
} from "../constants/fontOptions";

export interface ColumnWidths {
  size: number;
  date: number;
}

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  size: 96,
  date: 144,
};

export const MIN_COLUMN_WIDTHS: ColumnWidths = {
  size: 60,
  date: 90,
};

export const MAX_COLUMN_WIDTHS: ColumnWidths = {
  size: 260,
  date: 320,
};

export const clampColumnWidth = (column: keyof ColumnWidths, width: number): number => {
  return Math.min(
    MAX_COLUMN_WIDTHS[column],
    Math.max(MIN_COLUMN_WIDTHS[column], Math.round(width))
  );
};

interface SettingsState {
  fontSize: number; // in pixels
  fontFamily: string;
  panelLeftRatio: number; // percentage 0-100
  columnWidths: ColumnWidths;

  setFontSize: (size: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setPanelLeftRatio: (ratio: number) => void;
  setColumnWidth: (column: keyof ColumnWidths, width: number) => void;
  resetColumnWidths: () => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const getSettingsStorage = (): StateStorage => {
  if (typeof window === "undefined") {
    return noopStorage;
  }

  const storage = window.localStorage;
  if (
    storage &&
    typeof storage.getItem === "function" &&
    typeof storage.setItem === "function" &&
    typeof storage.removeItem === "function"
  ) {
    return storage;
  }

  return noopStorage;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontSize: 14,
      fontFamily: "",
      panelLeftRatio: 50,
      columnWidths: { ...DEFAULT_COLUMN_WIDTHS },

      setFontSize: (size) => set({ fontSize: size }),
      setFontFamily: (fontFamily) =>
        set({
          fontFamily: fontFamily.trim(),
        }),
      setPanelLeftRatio: (panelLeftRatio) => set({ panelLeftRatio }),
      setColumnWidth: (column, width) =>
        set((state) => ({
          columnWidths: {
            ...state.columnWidths,
            [column]: clampColumnWidth(column, width),
          },
        })),
      resetColumnWidths: () =>
        set({
          columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
        }),
    }),
    {
      name: "mycommander-settings",
      storage: createJSONStorage(getSettingsStorage),
      merge: (persistedState, currentState) => {
        const state =
          persistedState && typeof persistedState === "object"
            ? (persistedState as Partial<SettingsState> & {
                uiFontFamily?: unknown;
                monoFontFamily?: unknown;
                columnWidths?: Partial<ColumnWidths>;
              })
            : {};
        const persistedFontFamily =
          typeof state.fontFamily === "string"
            ? state.fontFamily
            : typeof state.uiFontFamily === "string"
              ? state.uiFontFamily
              : typeof state.monoFontFamily === "string"
                ? state.monoFontFamily
                : "";

        const persistedColumnWidths: Partial<ColumnWidths> =
          state.columnWidths && typeof state.columnWidths === "object"
            ? (state.columnWidths as Partial<ColumnWidths>)
            : {};
        const mergedColumnWidths: ColumnWidths = {
          size: typeof persistedColumnWidths.size === "number"
            ? clampColumnWidth("size", persistedColumnWidths.size)
            : DEFAULT_COLUMN_WIDTHS.size,
          date: typeof persistedColumnWidths.date === "number"
            ? clampColumnWidth("date", persistedColumnWidths.date)
            : DEFAULT_COLUMN_WIDTHS.date,
        };

        return {
          ...currentState,
          ...state,
          fontFamily: resolvePersistedFontFamily(
            persistedFontFamily,
            currentState.fontFamily
          ),
          columnWidths: mergedColumnWidths,
        };
      },
    }
  )
);
