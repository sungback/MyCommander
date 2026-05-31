import type { PanelState } from "../../../types/file";
import { getPanelAccessPath } from "../../../utils/panelPath";
import { getPathDisplayName } from "../../../utils/pathDisplay";
import type {
  CommandPaletteActions,
  CommandPaletteItem,
  CommandPaletteLocation,
  CommandTarget,
} from "./commandPaletteActions";

export const getPanelCommandPath = (panel: PanelState) =>
  getPanelAccessPath(panel);

export const getCommandSelectionLabel = (paths: string[]) => {
  if (paths.length === 0) {
    return "No selection";
  }

  if (paths.length > 1) {
    return `${paths.length} selected`;
  }

  return getPathDisplayName(paths[0]);
};

export const isZipTarget = (target: CommandTarget | null) =>
  target?.entry.kind === "file" && target.entry.name.toLowerCase().endsWith(".zip");

export const commandShortcut = (isMac: boolean) =>
  isMac ? "Cmd+Shift+P" : "Ctrl+Shift+P";

const getLocationSourceLabel = (location: CommandPaletteLocation) =>
  location.source === "frequent"
    ? `Frequent location${location.visitCount ? ` • ${location.visitCount} visits` : ""}`
    : "Recent location";

export const buildLocationItems = (
  locations: CommandPaletteLocation[] | undefined,
  actions: CommandPaletteActions
): CommandPaletteItem[] =>
  (locations ?? []).map((location) => ({
    id: `open-location:${location.path}`,
    title: `Open ${location.name}`,
    subtitle: `${getLocationSourceLabel(location)} • ${location.path}`,
    keywords: [
      "folder",
      "location",
      "path",
      "open",
      location.source,
      location.name,
      location.path,
    ],
    run: () => actions.openLocation(location.path),
  }));
