import { swapPanelLocations } from "./panelStoreReducers";
import { persistPanelVisibilityState } from "./panelStorePersistence";
import type {
  PanelStoreActions,
  PanelStoreSet,
} from "./panelStoreActionTypes";

type VisibilityActions = Pick<
  PanelStoreActions,
  | "setActivePanel"
  | "setPanelViewMode"
  | "setShowHiddenFiles"
  | "setThemePreference"
  | "swapPanels"
>;

export const createPanelStoreVisibilityActions = (
  set: PanelStoreSet
): VisibilityActions => ({
  swapPanels: () =>
    set((state) => {
      const swappedPanels = swapPanelLocations(
        state.leftPanel,
        state.rightPanel,
        state.panelViewModes
      );

      if (!swappedPanels) return state;

      persistPanelVisibilityState(state, swappedPanels);

      return swappedPanels;
    }),

  setActivePanel: (activePanel) =>
    set((state) => {
      persistPanelVisibilityState(state, { activePanel });
      return { activePanel };
    }),

  setShowHiddenFiles: (showHiddenFiles) =>
    set((state) => {
      persistPanelVisibilityState(state, { showHiddenFiles });
      return { showHiddenFiles };
    }),

  setThemePreference: (themePreference) =>
    set((state) => {
      persistPanelVisibilityState(state, { themePreference });
      return { themePreference };
    }),

  setPanelViewMode: (panel, viewMode) =>
    set((state) => {
      const nextPanelViewModes = {
        ...state.panelViewModes,
        [panel]: viewMode,
      };
      persistPanelVisibilityState(state, {
        panelViewModes: nextPanelViewModes,
      });
      return { panelViewModes: nextPanelViewModes };
    }),
});
