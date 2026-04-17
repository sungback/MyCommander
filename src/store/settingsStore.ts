import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  resolvePersistedFontFamily,
} from "../constants/fontOptions";

interface SettingsState {
  fontSize: number; // in pixels
  fontFamily: string;
  panelLeftRatio: number; // percentage 0-100
  
  setFontSize: (size: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setPanelLeftRatio: (ratio: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontSize: 14,
      fontFamily: "",
      panelLeftRatio: 50,

      setFontSize: (size) => set({ fontSize: size }),
      setFontFamily: (fontFamily) =>
        set({
          fontFamily: fontFamily.trim(),
        }),
      setPanelLeftRatio: (panelLeftRatio) => set({ panelLeftRatio }),
    }),
    {
      name: "mycommander-settings",
      merge: (persistedState, currentState) => {
        const state =
          persistedState && typeof persistedState === "object"
            ? (persistedState as Partial<SettingsState> & {
                uiFontFamily?: unknown;
                monoFontFamily?: unknown;
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

        return {
          ...currentState,
          ...state,
          fontFamily: resolvePersistedFontFamily(
            persistedFontFamily,
            currentState.fontFamily
          ),
        };
      },
    }
  )
);
