import { usePanelStore } from "./panelStore";
import { getPathDirectoryName, normalizePathForComparison } from "../utils/path";

type PanelId = "left" | "right";

const PANEL_IDS: PanelId[] = ["left", "right"];

export const refreshPanelsForDirectories = (directories: string[]) => {
  const normalizedDirectories = new Set(
    directories
      .filter((directory) => directory.length > 0)
      .map((directory) => normalizePathForComparison(directory))
  );

  if (normalizedDirectories.size === 0) {
    return;
  }

  const state = usePanelStore.getState();

  for (const panelId of PANEL_IDS) {
    const panel = panelId === "left" ? state.leftPanel : state.rightPanel;
    const normalizedCurrentPath = normalizePathForComparison(panel.currentPath);

    if (normalizedDirectories.has(normalizedCurrentPath)) {
      state.refreshPanel(panelId);
    }
  }
};

export const refreshPanelsForEntryPaths = (paths: string[]) => {
  refreshPanelsForDirectories(paths.map((path) => getPathDirectoryName(path)));
};
