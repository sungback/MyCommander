import {
  activatePanelTab,
  addTabToPanel,
  closePanelTab,
  getPanelKey,
} from "./panelStoreReducers";
import { persistPanelUpdate } from "./panelStorePersistence";
import {
  panelUpdate,
  type PanelStoreActions,
  type PanelStoreSet,
} from "./panelStoreActionTypes";

type TabActions = Pick<PanelStoreActions, "activateTab" | "addTab" | "closeTab">;

export const createPanelStoreTabActions = (set: PanelStoreSet): TabActions => ({
  addTab: (panel) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = addTabToPanel(state[panelKey]);

      persistPanelUpdate(state, panel, nextPanelState);

      return panelUpdate(panelKey, nextPanelState);
    }),

  activateTab: (panel, tabId) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = activatePanelTab(state[panelKey], tabId);
      if (!nextPanelState) {
        return {};
      }

      persistPanelUpdate(state, panel, nextPanelState);

      return panelUpdate(panelKey, nextPanelState);
    }),

  closeTab: (panel, tabId) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = closePanelTab(state[panelKey], tabId);
      if (!nextPanelState) {
        return {};
      }

      persistPanelUpdate(state, panel, nextPanelState);

      return panelUpdate(panelKey, nextPanelState);
    }),
});
