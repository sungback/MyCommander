import { PanelId, SortDirection, SortField, ViewMode } from "../types/file";
import { ThemePreference } from "../types/theme";

export interface PersistedPanelState {
  activePanel?: PanelId;
  leftPath?: string;
  rightPath?: string;
  leftPanel?: PersistedPanelData;
  rightPanel?: PersistedPanelData;
  showHiddenFiles?: boolean;
  themePreference?: ThemePreference;
  viewMode?: ViewMode;
  leftViewMode?: ViewMode;
  rightViewMode?: ViewMode;
}

export interface PersistedPanelData {
  tabs: PersistedTabState[];
  activeTabId?: string;
}

export interface PersistedTabState {
  id: string;
  currentPath: string;
  history: string[];
  historyIndex: number;
  sortField: SortField;
  sortDirection: SortDirection;
}

const PANEL_STATE_STORAGE_KEY = "total-commander:panel-state";

export const createTabId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isSortField = (value: unknown): value is SortField =>
  value === "name" || value === "ext" || value === "size" || value === "date";

const isSortDirection = (value: unknown): value is SortDirection =>
  value === "asc" || value === "desc";

export const readPersistedPanelState = (): PersistedPanelState => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawState = window.localStorage.getItem(PANEL_STATE_STORAGE_KEY);
    if (!rawState) {
      return {};
    }

    const parsed = JSON.parse(rawState) as PersistedPanelState;

    const restoreTab = (tab: unknown): PersistedTabState | null => {
      if (!tab || typeof tab !== "object") {
        return null;
      }

      const currentPath = Reflect.get(tab, "currentPath");
      if (typeof currentPath !== "string" || currentPath.length === 0) {
        return null;
      }

      const historyValue = Reflect.get(tab, "history");
      const history = Array.isArray(historyValue)
        ? historyValue.filter((entry): entry is string => typeof entry === "string")
        : [];
      const historyIndexValue = Reflect.get(tab, "historyIndex");
      const clampedHistoryIndex =
        typeof historyIndexValue === "number" && Number.isFinite(historyIndexValue)
          ? Math.min(Math.max(Math.trunc(historyIndexValue), -1), history.length - 1)
          : -1;
      const sortField = isSortField(Reflect.get(tab, "sortField"))
        ? (Reflect.get(tab, "sortField") as SortField)
        : "name";
      const sortDirection = isSortDirection(Reflect.get(tab, "sortDirection"))
        ? (Reflect.get(tab, "sortDirection") as SortDirection)
        : "asc";

      return {
        id:
          typeof Reflect.get(tab, "id") === "string" && Reflect.get(tab, "id")
            ? (Reflect.get(tab, "id") as string)
            : createTabId(),
        currentPath,
        history,
        historyIndex: clampedHistoryIndex,
        sortField,
        sortDirection,
      };
    };

    const restorePanel = (panel: unknown): PersistedPanelData | undefined => {
      if (!panel || typeof panel !== "object") {
        return undefined;
      }

      const tabsValue = Reflect.get(panel, "tabs");
      const tabs = Array.isArray(tabsValue)
        ? tabsValue
            .map((tab) => restoreTab(tab))
            .filter((tab): tab is PersistedTabState => tab !== null)
        : [];

      if (tabs.length === 0) {
        return undefined;
      }

      const activeTabId = Reflect.get(panel, "activeTabId");

      return {
        tabs,
        activeTabId: typeof activeTabId === "string" ? activeTabId : undefined,
      };
    };

    return {
      activePanel:
        parsed.activePanel === "left" || parsed.activePanel === "right"
          ? parsed.activePanel
          : undefined,
      leftPath: typeof parsed.leftPath === "string" ? parsed.leftPath : undefined,
      rightPath: typeof parsed.rightPath === "string" ? parsed.rightPath : undefined,
      leftPanel: restorePanel(parsed.leftPanel),
      rightPanel: restorePanel(parsed.rightPanel),
      showHiddenFiles:
        typeof parsed.showHiddenFiles === "boolean" ? parsed.showHiddenFiles : undefined,
      themePreference:
        parsed.themePreference === "auto" ||
        parsed.themePreference === "light" ||
        parsed.themePreference === "dark"
          ? parsed.themePreference
          : undefined,
      viewMode:
        parsed.viewMode === "brief" || parsed.viewMode === "detailed"
          ? parsed.viewMode
          : undefined,
      leftViewMode:
        parsed.leftViewMode === "brief" || parsed.leftViewMode === "detailed"
          ? parsed.leftViewMode
          : undefined,
      rightViewMode:
        parsed.rightViewMode === "brief" || parsed.rightViewMode === "detailed"
          ? parsed.rightViewMode
          : undefined,
    };
  } catch (error) {
    console.error("Failed to restore panel state:", error);
    return {};
  }
};

export const writePersistedPanelState = (state: PersistedPanelState) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to persist panel state:", error);
  }
};
