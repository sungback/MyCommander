import type { PanelId, PanelState, ViewMode } from "../types/file";
import { persistVisiblePanelState } from "../utils/panelHelpers";
import type { PanelViewModes } from "./panelStoreReducers";
import type { AppState } from "./panelStoreTypes";

type PersistablePanelStoreState = Pick<
  AppState,
  | "leftPanel"
  | "rightPanel"
  | "activePanel"
  | "showHiddenFiles"
  | "themePreference"
  | "panelViewModes"
>;

type PanelVisibilityPersistOverrides = Partial<PersistablePanelStoreState>;

interface PersistedPanelViewModeState {
  leftViewMode?: ViewMode;
  rightViewMode?: ViewMode;
  viewMode?: ViewMode;
}

export const resolvePersistedPanelViewModes = (
  persistedPanelState: PersistedPanelViewModeState
): PanelViewModes => ({
  left: persistedPanelState.leftViewMode ?? persistedPanelState.viewMode ?? "detailed",
  right: persistedPanelState.rightViewMode ?? persistedPanelState.viewMode ?? "detailed",
});

export const getPanelsAfterUpdate = (
  state: AppState,
  panel: PanelId,
  nextPanelState: PanelState
) => ({
  leftPanel: panel === "left" ? nextPanelState : state.leftPanel,
  rightPanel: panel === "right" ? nextPanelState : state.rightPanel,
});

export const persistPanelVisibilityState = (
  state: PersistablePanelStoreState,
  overrides: PanelVisibilityPersistOverrides = {}
) => {
  persistVisiblePanelState(
    overrides.leftPanel ?? state.leftPanel,
    overrides.rightPanel ?? state.rightPanel,
    overrides.activePanel ?? state.activePanel,
    overrides.showHiddenFiles ?? state.showHiddenFiles,
    overrides.themePreference ?? state.themePreference,
    overrides.panelViewModes ?? state.panelViewModes
  );
};

export const persistPanelUpdate = (
  state: AppState,
  panel: PanelId,
  nextPanelState: PanelState
) => {
  persistPanelVisibilityState(
    state,
    getPanelsAfterUpdate(state, panel, nextPanelState)
  );
};
