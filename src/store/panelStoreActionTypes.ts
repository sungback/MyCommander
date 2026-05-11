import type { StateCreator } from "zustand";
import type { AppState } from "./panelStoreTypes";

export type PanelStoreSet = Parameters<StateCreator<AppState>>[0];
export type PanelStateKey = "leftPanel" | "rightPanel";
type PanelStoreStateKey =
  | PanelStateKey
  | "activePanel"
  | "panelViewModes"
  | "showHiddenFiles"
  | "sizeCache"
  | "sizeStatusCache"
  | "themePreference";

export type PanelStoreActions = Omit<AppState, PanelStoreStateKey>;

export const panelUpdate = (
  panelKey: PanelStateKey,
  nextPanelState: AppState[PanelStateKey]
) => ({ [panelKey]: nextPanelState });
