import {
  getFileOperationUndoSubtitle,
  type FileOperationUndoOperation,
} from "../../../store/fileOperationUndoStore";
import type { PanelId, PanelState } from "../../../types/file";
import { getPanelAccessPath } from "../../../utils/panelPath";
import { getPathDisplayName } from "../../../utils/pathDisplay";
import type {
  CommandPaletteActions,
  CommandPaletteItem,
  CommandPaletteLocation,
  CommandTarget,
} from "./commandPaletteActions";

export interface BuildCommandPaletteItemsArgs {
  activePanelId: PanelId;
  activePanel: PanelState;
  actions: CommandPaletteActions;
  isMac: boolean;
  locations?: CommandPaletteLocation[];
  primaryTarget: CommandTarget | null;
  selectedPaths: string[];
  showHiddenFiles: boolean;
  undoOperation?: FileOperationUndoOperation | null;
}

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

const isZipTarget = (target: CommandTarget | null) =>
  target?.entry.kind === "file" && target.entry.name.toLowerCase().endsWith(".zip");

const commandShortcut = (isMac: boolean) => (isMac ? "Cmd+Shift+P" : "Ctrl+Shift+P");

const getLocationSourceLabel = (location: CommandPaletteLocation) =>
  location.source === "frequent"
    ? `Frequent location${location.visitCount ? ` • ${location.visitCount} visits` : ""}`
    : "Recent location";

const buildLocationItems = (
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

export const buildCommandPaletteItems = ({
  activePanelId,
  activePanel,
  actions,
  isMac,
  locations,
  primaryTarget,
  selectedPaths,
  showHiddenFiles,
  undoOperation,
}: BuildCommandPaletteItemsArgs): CommandPaletteItem[] => {
  const selectionLabel = getCommandSelectionLabel(selectedPaths);
  const singleTargetReason = primaryTarget ? undefined : "Select one item";
  const selectionReason = selectedPaths.length > 0 ? undefined : "No files selected";
  const fileTargetReason =
    primaryTarget?.entry.kind === "file" ? undefined : "Select a file";
  const zipReason = isZipTarget(primaryTarget) ? undefined : "Select a ZIP archive";
  const activePath = getPanelCommandPath(activePanel);
  const activePanelLabel = `${activePanelId.toUpperCase()} panel`;

  return [
    {
      id: "command-palette",
      title: "Command Palette",
      subtitle: "Find and run commands",
      shortcut: commandShortcut(isMac),
      keywords: ["action", "run", "ctrl shift p", "cmd shift p"],
      disabledReason: "Already open",
      run: () => undefined,
    },
    {
      id: "preview",
      title: "Open Quick Preview",
      subtitle: primaryTarget?.entry.name ?? "No item selected",
      shortcut: "F3",
      keywords: ["view", "quick look", "space"],
      disabledReason: singleTargetReason,
      run: actions.openPreview,
    },
    {
      id: "edit",
      title: "Open in Editor",
      subtitle: primaryTarget?.entry.name ?? "No file selected",
      shortcut: "F4",
      keywords: ["edit", "open"],
      disabledReason: fileTargetReason,
      run: actions.openEditor,
    },
    {
      id: "copy",
      title: "Copy to Other Panel",
      subtitle: selectionLabel,
      shortcut: "F5",
      keywords: ["copy selected"],
      disabledReason: selectionReason,
      run: actions.openCopy,
    },
    {
      id: "move",
      title: "Move to Other Panel",
      subtitle: selectionLabel,
      shortcut: "F6",
      keywords: ["move selected", "rename path"],
      disabledReason: selectionReason,
      run: actions.openMove,
    },
    {
      id: "delete",
      title: "Delete Selected",
      subtitle: selectionLabel,
      shortcut: "F8",
      keywords: ["trash", "remove"],
      disabledReason: selectionReason,
      run: actions.openDelete,
    },
    {
      id: "rename",
      title: "Rename Selected Item",
      subtitle: primaryTarget?.entry.name ?? "No item selected",
      keywords: ["f2", "name"],
      disabledReason: singleTargetReason,
      run: actions.openRename,
    },
    {
      id: "undo-file-operation",
      title: "Undo Last File Operation",
      subtitle: getFileOperationUndoSubtitle(undoOperation ?? null),
      keywords: ["undo", "revert", "rename", "move"],
      disabledReason: undoOperation ? undefined : "No rename or move to undo",
      run: actions.undoLastFileOperation,
    },
    {
      id: "new-file",
      title: "Create New File",
      subtitle: activePath,
      shortcut: "Shift+F4",
      keywords: ["touch", "file"],
      run: actions.openNewFile,
    },
    {
      id: "new-folder",
      title: "Create New Folder",
      subtitle: activePath,
      shortcut: "F7",
      keywords: ["mkdir", "directory"],
      run: actions.openMkdir,
    },
    ...buildLocationItems(locations, actions),
    {
      id: "search",
      title: "Search Files",
      subtitle: activePath,
      shortcut: isMac ? "Option+F7" : "Alt+F7",
      keywords: ["find", "filter"],
      run: actions.openSearch,
    },
    {
      id: "compare-folders",
      title: "Compare Left and Right Folders",
      subtitle: "Open folder sync comparison",
      shortcut: "F11",
      keywords: ["sync", "synchronize", "diff"],
      run: actions.openSync,
    },
    {
      id: "sync-other-panel",
      title: "Sync Other Panel to Current Path",
      subtitle: activePanelLabel,
      shortcut: isMac ? "Cmd+Shift+M" : "Ctrl+Shift+M",
      keywords: ["target equals source", "same path"],
      run: actions.syncOtherPanel,
    },
    {
      id: "calculate-folder-sizes",
      title: "Calculate Folder Sizes",
      subtitle: activePanelLabel,
      shortcut: isMac ? "Cmd+L" : "Ctrl+L",
      keywords: ["directory", "folder", "size", "du"],
      run: actions.calculateFolderSizes,
    },
    {
      id: "create-zip",
      title: "Create ZIP from Selection",
      subtitle: selectionLabel,
      keywords: ["archive", "compress", "zip"],
      disabledReason: selectionReason,
      run: actions.createZipFromSelection,
    },
    {
      id: "extract-zip",
      title: "Extract ZIP Here",
      subtitle: primaryTarget?.entry.name ?? "No archive selected",
      keywords: ["archive", "unzip", "extract"],
      disabledReason: zipReason,
      run: actions.extractZip,
    },
    {
      id: "terminal",
      title: "Open Terminal Here",
      subtitle: activePath,
      keywords: ["shell", "command line", "cmd"],
      run: actions.openTerminal,
    },
    {
      id: "toggle-hidden-files",
      title: showHiddenFiles ? "Hide Hidden Files" : "Show Hidden Files",
      subtitle: activePanelLabel,
      keywords: ["dotfiles", "hidden"],
      run: actions.toggleHiddenFiles,
    },
    {
      id: "copy-current-path",
      title: "Copy Current Path",
      subtitle: activePath,
      shortcut: isMac ? "Cmd+Shift+C" : "Ctrl+Shift+C",
      keywords: ["clipboard", "path"],
      run: actions.copyCurrentPath,
    },
    {
      id: "copy-to-clipboard",
      title: "Copy Selected to Clipboard",
      subtitle: selectionLabel,
      shortcut: isMac ? "Cmd+C" : "Ctrl+C",
      keywords: ["clipboard", "pasteboard"],
      disabledReason: selectionReason,
      run: actions.copyToClipboard,
    },
    {
      id: "cut-to-clipboard",
      title: "Cut Selected to Clipboard",
      subtitle: selectionLabel,
      shortcut: isMac ? "Cmd+X" : "Ctrl+X",
      keywords: ["clipboard", "pasteboard"],
      disabledReason: selectionReason,
      run: actions.cutToClipboard,
    },
    {
      id: "paste",
      title: "Paste from Clipboard",
      subtitle: activePath,
      shortcut: isMac ? "Cmd+V" : "Ctrl+V",
      keywords: ["clipboard", "pasteboard"],
      run: actions.pasteFromClipboard,
    },
    {
      id: "info",
      title: "Show File Info",
      subtitle: primaryTarget?.entry.name ?? "No item selected",
      shortcut: isMac ? "Cmd+I" : "Ctrl+I",
      keywords: ["metadata", "properties"],
      disabledReason: singleTargetReason,
      run: actions.openInfo,
    },
    {
      id: "swap-panels",
      title: "Swap Panels",
      subtitle: "Exchange left and right panel state",
      shortcut: isMac ? "Cmd+U" : "Ctrl+U",
      keywords: ["left right"],
      run: actions.swapPanels,
    },
    {
      id: "job-center",
      title: "Open Job Center",
      subtitle: "Review queued and completed jobs",
      keywords: ["progress", "queue", "history"],
      run: actions.openJobCenter,
    },
    {
      id: "select-wildcard",
      title: "Select by Pattern...",
      subtitle: activePanelLabel,
      shortcut: isMac ? "Cmd+Shift+S" : "Ctrl+Shift+S",
      keywords: ["wildcard", "select group", "glob", "pattern", "filter"],
      run: () => actions.openWildcardSelect("select"),
    },
    {
      id: "unselect-wildcard",
      title: "Unselect by Pattern...",
      subtitle: activePanelLabel,
      shortcut: isMac ? "Cmd+Shift+D" : "Ctrl+Shift+D",
      keywords: ["wildcard", "unselect group", "glob", "pattern", "deselect"],
      run: () => actions.openWildcardSelect("unselect"),
    },
    {
      id: "invert-selection",
      title: "Invert Selection",
      subtitle: activePanelLabel,
      shortcut: isMac ? "Cmd+Shift+I" : "Ctrl+Shift+I",
      keywords: ["invert", "reverse selection", "toggle selection"],
      run: actions.invertSelection,
    },
    {
      id: "select-same-extension",
      title: "Select Same Extension",
      subtitle: activePanelLabel,
      shortcut: "Alt+Num+",
      keywords: ["same extension","select all ext","type"],
      run: () => actions.runSelectionCommand("select-same-extension"),
    },
    {
      id: "save-selection",
      title: "Save Selection",
      subtitle: activePanelLabel,
      keywords: ["remember","store selection"],
      run: () => actions.runSelectionCommand("save-selection"),
    },
    {
      id: "restore-selection",
      title: "Restore Selection",
      subtitle: activePanelLabel,
      shortcut: "Num /",
      keywords: ["recall","load selection"],
      run: () => actions.runSelectionCommand("restore-selection"),
    },
    {
      id: "save-selection-to-file",
      title: "Save Selection to File...",
      subtitle: activePanelLabel,
      keywords: ["export selection","list"],
      run: () => actions.runSelectionCommand("save-selection-to-file"),
    },
    {
      id: "load-selection-from-file",
      title: "Load Selection from File...",
      subtitle: activePanelLabel,
      keywords: ["import selection","list"],
      run: () => actions.runSelectionCommand("load-selection-from-file"),
    },
    {
      id: "copy-selected-names",
      title: "Copy Names to Clipboard",
      subtitle: selectionLabel,
      keywords: ["clipboard","file name"],
      run: () => actions.runSelectionCommand("copy-selected-names"),
    },
    {
      id: "copy-selected-paths",
      title: "Copy Full Paths to Clipboard",
      subtitle: selectionLabel,
      keywords: ["clipboard","path"],
      run: () => actions.runSelectionCommand("copy-selected-paths"),
    },
    {
      id: "copy-selected-details",
      title: "Copy Details to Clipboard",
      subtitle: selectionLabel,
      keywords: ["clipboard","size","date"],
      run: () => actions.runSelectionCommand("copy-selected-details"),
    },
    {
      id: "copy-selected-path-details",
      title: "Copy Paths with Details to Clipboard",
      subtitle: selectionLabel,
      keywords: ["clipboard","path","size","date"],
      run: () => actions.runSelectionCommand("copy-selected-path-details"),
    },
    {
      id: "checksum-generate",
      title: "Create Checksums...",
      subtitle: selectionLabel,
      keywords: ["hash", "md5", "sha1", "sha256", "crc32", "checksum"],
      disabledReason: selectionReason,
      run: () => actions.openChecksum("generate"),
    },
    {
      id: "checksum-verify",
      title: "Verify Checksums...",
      subtitle: activePanelLabel,
      keywords: ["hash", "md5", "sha1", "sha256", "sfv", "checksum", "verify"],
      run: () => actions.openChecksum("verify"),
    },
    {
      id: "settings",
      title: "Open Settings",
      subtitle: "Preferences",
      keywords: ["preferences", "prefs", "config"],
      run: actions.openSettings,
    },
    {
      id: "check-updates",
      title: "Check for Updates",
      subtitle: "Check for new MyCommander release",
      keywords: ["update", "version", "upgrade", "release", "github"],
      run: actions.checkForUpdates,
    },
    {
      id: "quit",
      title: "Quit MyCommander",
      subtitle: "Close the app",
      shortcut: isMac ? "Cmd+Q" : "Alt+F4",
      keywords: ["exit", "close"],
      run: actions.closeApp,
    },
  ];
};
