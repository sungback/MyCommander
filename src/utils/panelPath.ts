import { arePathsEquivalent, coalescePanelPath } from "./path";

export interface PanelPathLike {
  currentPath: string;
  resolvedPath?: string | null;
}

export const getPanelDisplayPath = (panel: PanelPathLike) => panel.currentPath;

export const getPanelAccessPath = (panel: PanelPathLike) =>
  coalescePanelPath(panel.resolvedPath, panel.currentPath);

export const arePanelAccessPathsEquivalent = (
  leftPanel: PanelPathLike,
  rightPanel: PanelPathLike
) => arePathsEquivalent(getPanelAccessPath(leftPanel), getPanelAccessPath(rightPanel));
