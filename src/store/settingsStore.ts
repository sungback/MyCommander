import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  fontSize: number; // in pixels
  panelLeftRatio: number; // percentage 0-100
  
  setFontSize: (size: number) => void;
  setPanelLeftRatio: (ratio: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontSize: 14,
      panelLeftRatio: 50,

      setFontSize: (size) => set({ fontSize: size }),
      setPanelLeftRatio: (panelLeftRatio) => set({ panelLeftRatio }),
    }),
    {
      name: "mycommander-settings",
    }
  )
);
