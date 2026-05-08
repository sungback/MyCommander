import type {
  PanelStoreActions,
  PanelStoreSet,
} from "./panelStoreActionTypes";
import { createPanelStoreFileActions } from "./panelStoreFileActions";
import { createPanelStoreNavigationActions } from "./panelStoreNavigationActions";
import { createPanelStoreSelectionActions } from "./panelStoreSelectionActions";
import { createPanelStoreTabActions } from "./panelStoreTabActions";
import { createPanelStoreVisibilityActions } from "./panelStoreVisibilityActions";

export const createPanelStoreActions = (
  set: PanelStoreSet
): PanelStoreActions => ({
  ...createPanelStoreVisibilityActions(set),
  ...createPanelStoreTabActions(set),
  ...createPanelStoreNavigationActions(set),
  ...createPanelStoreFileActions(set),
  ...createPanelStoreSelectionActions(set),
});
