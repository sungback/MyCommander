import { create } from "zustand";
import { readPersistedPanelState } from "./persistence";
import { restorePersistedPanelState } from "../utils/panelHelpers";
import { createPanelStoreActions } from "./panelStoreActions";
import { resolvePersistedPanelViewModes } from "./panelStorePersistence";
import type { AppState } from "./panelStoreTypes";

export const usePanelStore = create<AppState>((set) => {
  const persistedPanelState = readPersistedPanelState();
  const panelViewModes = resolvePersistedPanelViewModes(persistedPanelState);

  return {
    leftPanel: restorePersistedPanelState(
      "left",
      persistedPanelState.leftPanel,
      persistedPanelState.leftPath
    ),
    rightPanel: restorePersistedPanelState(
      "right",
      persistedPanelState.rightPanel,
      persistedPanelState.rightPath
    ),
    sizeCache: {},
    sizeStatusCache: {},
    sizeCacheStale: {},
    activePanel: persistedPanelState.activePanel ?? "left",
    showHiddenFiles: persistedPanelState.showHiddenFiles ?? false,
    themePreference: persistedPanelState.themePreference ?? "auto",
    panelViewModes,
    ...createPanelStoreActions(set),
  };
});
