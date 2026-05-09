import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Archive,
  Command,
  Copy,
  Eye,
  FilePenLine,
  FilePlus,
  FolderPlus,
  FolderOpen,
  Info,
  Keyboard,
  ListChecks,
  MoveRight,
  PanelsLeftRight,
  Search,
  Settings,
  Terminal,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import { useClipboardStore } from "../../store/clipboardStore";
import { useDialogStore } from "../../store/dialogStore";
import { useJobStore } from "../../store/jobStore";
import {
  getFrequentLocations,
  getRecentLocations,
  useLocationHistoryStore,
} from "../../store/locationHistoryStore";
import { refreshPanelsForDirectories } from "../../store/panelRefresh";
import { usePanelStore } from "../../store/panelStore";
import { showTransientToast } from "../../store/toastStore";
import { writeClipboardText } from "../../utils/clipboard";
import { getPathDirectoryName } from "../../utils/path";
import { isMacPlatform } from "../../hooks/useAppCommands";
import {
  buildCommandPaletteItems,
  filterCommandPaletteItems,
  getPanelCommandPath,
  getPrimaryCommandTarget,
  getSelectedCommandPaths,
  moveCommandPaletteSelection,
  type CommandPaletteActions,
  type CommandPaletteItem,
  type CommandPaletteLocation,
} from "./commandPaletteActions";

const ITEM_ICONS: Record<string, LucideIcon> = {
  "command-palette": Command,
  preview: Eye,
  edit: FilePenLine,
  copy: Copy,
  move: MoveRight,
  delete: Trash2,
  rename: FilePenLine,
  "new-file": FilePlus,
  "new-folder": FolderPlus,
  search: Search,
  "compare-folders": ListChecks,
  "sync-other-panel": PanelsLeftRight,
  "create-zip": Archive,
  "extract-zip": Archive,
  terminal: Terminal,
  "toggle-hidden-files": Eye,
  "copy-current-path": Copy,
  "copy-to-clipboard": Copy,
  "cut-to-clipboard": Trash2,
  paste: Copy,
  info: Info,
  "swap-panels": PanelsLeftRight,
  "job-center": ListChecks,
  settings: Settings,
  quit: Keyboard,
};

const getCommandIcon = (item: CommandPaletteItem) =>
  item.id.startsWith("open-location:") ? FolderOpen : ITEM_ICONS[item.id] ?? Command;

const getArchiveStem = (path: string) =>
  path.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean).pop() || "Archive";

const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" &&
  value !== null &&
  typeof Reflect.get(value, "then") === "function";

const CommandRow = ({
  item,
  isActive,
  onRun,
}: {
  item: CommandPaletteItem;
  isActive: boolean;
  onRun: (item: CommandPaletteItem) => void;
}) => {
  const Icon = getCommandIcon(item);
  const isDisabled = Boolean(item.disabledReason);

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => onRun(item)}
      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
        isActive
          ? "border-accent-color bg-bg-selected"
          : "border-transparent bg-transparent"
      } ${isDisabled ? "cursor-default opacity-55" : "hover:bg-bg-hover"}`}
    >
      <span className="shrink-0 text-accent-color">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text-primary">
          {item.title}
        </span>
        <span className="block truncate text-xs text-text-secondary">
          {item.disabledReason ?? item.subtitle}
        </span>
      </span>
      {item.shortcut ? (
        <span className="shrink-0 rounded border border-border-color bg-bg-primary px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
          {item.shortcut}
        </span>
      ) : null}
    </button>
  );
};

export const CommandPalette: React.FC = () => {
  const openDialog = useDialogStore((state) => state.openDialog);
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const setOpenDialog = useDialogStore((state) => state.setOpenDialog);
  const openRenameDialog = useDialogStore((state) => state.openRenameDialog);
  const openInfoDialog = useDialogStore((state) => state.openInfoDialog);
  const openPreviewDialog = useDialogStore((state) => state.openPreviewDialog);
  const activePanelId = usePanelStore((state) => state.activePanel);
  const leftPanel = usePanelStore((state) => state.leftPanel);
  const rightPanel = usePanelStore((state) => state.rightPanel);
  const showHiddenFiles = usePanelStore((state) => state.showHiddenFiles);
  const setShowHiddenFiles = usePanelStore((state) => state.setShowHiddenFiles);
  const swapPanels = usePanelStore((state) => state.swapPanels);
  const setActivePanel = usePanelStore((state) => state.setActivePanel);
  const setPath = usePanelStore((state) => state.setPath);
  const refreshPanel = usePanelStore((state) => state.refreshPanel);
  const locations = useLocationHistoryStore((state) => state.locations);
  const setClipboard = useClipboardStore((state) => state.setClipboard);
  const clipboard = useClipboardStore((state) => state.clipboard);
  const upsertJob = useJobStore((state) => state.upsertJob);
  const fs = useFileSystem();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isOpen = openDialog === "commandPalette";
  const isMac = isMacPlatform();
  const activePanel = activePanelId === "left" ? leftPanel : rightPanel;
  const selectedPaths = useMemo(
    () => getSelectedCommandPaths(activePanel),
    [activePanel]
  );
  const primaryTarget = useMemo(
    () => getPrimaryCommandTarget(activePanel, activePanelId),
    [activePanel, activePanelId]
  );
  const activeAccessPath = getPanelCommandPath(activePanel);
  const commandLocations = useMemo<CommandPaletteLocation[]>(() => {
    const frequent = getFrequentLocations(locations, 4).map((location) => ({
      path: location.path,
      name: location.name,
      visitCount: location.visitCount,
      source: "frequent" as const,
    }));
    const frequentPaths = new Set(frequent.map((location) => location.path));
    const recent = getRecentLocations(locations, 6)
      .filter((location) => !frequentPaths.has(location.path))
      .map((location) => ({
        path: location.path,
        name: location.name,
        visitCount: location.visitCount,
        source: "recent" as const,
      }));

    return [...frequent, ...recent];
  }, [locations]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setQuery("");
    setSelectedIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  const actions = useMemo<CommandPaletteActions>(
    () => ({
      closeApp: async () => {
        closeDialog();
        try {
          await fs.quitApp();
        } catch (error) {
          console.error("Failed to quit app:", error);
        }
      },
      copyCurrentPath: async () => {
        closeDialog();
        try {
          await writeClipboardText(activePanel.currentPath);
          showTransientToast("경로를 복사했습니다.");
        } catch (error) {
          console.error("Failed to copy current path:", error);
          showTransientToast("클립보드를 사용할 수 없습니다.", { tone: "error" });
        }
      },
      copyToClipboard: async () => {
        if (selectedPaths.length === 0) {
          return;
        }
        closeDialog();
        setClipboard({
          paths: selectedPaths,
          operation: "copy",
          sourcePanel: activePanelId,
        });
        try {
          await fs.writeFilesToPasteboard(selectedPaths, "copy");
        } catch (error) {
          console.error("Failed to write copy paths to pasteboard:", error);
        }
        showTransientToast(`${selectedPaths.length}개 항목 복사됨`);
      },
      createZipFromSelection: async () => {
        if (selectedPaths.length === 0) {
          return;
        }
        closeDialog();
        try {
          const job = await fs.submitJob({
            kind: "zipSelection",
            paths: selectedPaths,
            targetDir: activeAccessPath,
            archiveName: getArchiveStem(activePanel.currentPath),
          });
          upsertJob(job);
          setOpenDialog("progress");
          showTransientToast("압축 작업이 대기열에 추가되었습니다.");
        } catch (error) {
          console.error("Failed to create ZIP from selection:", error);
          showTransientToast("압축 작업을 시작하지 못했습니다.", { tone: "error" });
        }
      },
      cutToClipboard: async () => {
        if (selectedPaths.length === 0) {
          return;
        }
        closeDialog();
        setClipboard({
          paths: selectedPaths,
          operation: "cut",
          sourcePanel: activePanelId,
        });
        try {
          await fs.writeFilesToPasteboard(selectedPaths, "cut");
        } catch (error) {
          console.error("Failed to write cut paths to pasteboard:", error);
        }
        showTransientToast(`${selectedPaths.length}개 항목 잘라내기됨`);
      },
      extractZip: async () => {
        if (!primaryTarget) {
          return;
        }
        closeDialog();
        try {
          await fs.extractZip(primaryTarget.path);
          refreshPanelsForDirectories([getPathDirectoryName(primaryTarget.path)]);
          showTransientToast("압축을 해제했습니다.");
        } catch (error) {
          console.error("Failed to extract ZIP:", error);
          showTransientToast("압축을 해제하지 못했습니다.", { tone: "error" });
        }
      },
      openCopy: () => setOpenDialog("copy"),
      openDelete: () => setOpenDialog("delete"),
      openEditor: async () => {
        if (!primaryTarget) {
          return;
        }
        closeDialog();
        try {
          await fs.openInEditor(primaryTarget.path);
        } catch (error) {
          console.error("Failed to open editor:", error);
          window.alert(getErrorMessage(error, "Failed to open the editor."));
        }
      },
      openInfo: () => {
        if (!primaryTarget) {
          return;
        }
        setActivePanel(primaryTarget.panelId);
        openInfoDialog({
          panelId: primaryTarget.panelId,
          path: primaryTarget.path,
          entry: primaryTarget.entry,
        });
      },
      openJobCenter: () => setOpenDialog("jobcenter"),
      openLocation: (path: string) => {
        closeDialog();
        setPath(activePanelId, path);
      },
      openMkdir: () => setOpenDialog("mkdir"),
      openMove: () => setOpenDialog("move"),
      openNewFile: () => setOpenDialog("newfile"),
      openPreview: () => {
        if (!primaryTarget) {
          return;
        }
        setActivePanel(primaryTarget.panelId);
        openPreviewDialog({
          panelId: primaryTarget.panelId,
          path: primaryTarget.path,
          entry: primaryTarget.entry,
        });
      },
      openRename: () => {
        if (!primaryTarget) {
          return;
        }
        setActivePanel(primaryTarget.panelId);
        openRenameDialog({
          panelId: primaryTarget.panelId,
          path: primaryTarget.path,
          entry: primaryTarget.entry,
        });
      },
      openSearch: () => setOpenDialog("search"),
      openSettings: () => setOpenDialog("settings"),
      openSync: () => setOpenDialog("sync"),
      openTerminal: async () => {
        closeDialog();
        try {
          await fs.openInTerminal(activeAccessPath);
        } catch (error) {
          console.error("Failed to open terminal:", error);
          showTransientToast("터미널을 열 수 없습니다.", { tone: "error" });
        }
      },
      pasteFromClipboard: () => {
        if (!clipboard) {
          closeDialog();
          showTransientToast("붙여넣을 항목이 없습니다.", { tone: "warning" });
          return;
        }
        setOpenDialog(clipboard.operation === "copy" ? "copy" : "move");
      },
      swapPanels: () => {
        closeDialog();
        swapPanels();
      },
      syncOtherPanel: () => {
        closeDialog();
        const state = usePanelStore.getState();
        const targetPanelId = activePanelId === "left" ? "right" : "left";
        state.setPath(targetPanelId, activePanel.currentPath);
      },
      toggleHiddenFiles: () => {
        closeDialog();
        setShowHiddenFiles(!showHiddenFiles);
        refreshPanel(activePanelId);
        showTransientToast(showHiddenFiles ? "숨김 파일을 숨겼습니다." : "숨김 파일을 표시합니다.");
      },
    }),
    [
      activeAccessPath,
      activePanel.currentPath,
      activePanelId,
      clipboard,
      closeDialog,
      fs,
      openInfoDialog,
      openPreviewDialog,
      openRenameDialog,
      primaryTarget,
      refreshPanel,
      selectedPaths,
      setActivePanel,
      setClipboard,
      setOpenDialog,
      setPath,
      setShowHiddenFiles,
      showHiddenFiles,
      swapPanels,
      upsertJob,
    ]
  );

  const items = useMemo(
    () =>
      buildCommandPaletteItems({
        activePanelId,
        activePanel,
        actions,
        isMac,
        locations: commandLocations,
        primaryTarget,
        selectedPaths,
        showHiddenFiles,
      }),
    [
      actions,
      activePanel,
      activePanelId,
      isMac,
      commandLocations,
      primaryTarget,
      selectedPaths,
      showHiddenFiles,
    ]
  );
  const filteredItems = useMemo(
    () => filterCommandPaletteItems(items, query),
    [items, query]
  );
  const selectedItem = filteredItems[selectedIndex] ?? filteredItems[0] ?? null;

  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(0);
    }
  }, [filteredItems.length, selectedIndex]);

  const runCommand = (item: CommandPaletteItem | null) => {
    if (!item || item.disabledReason) {
      return;
    }

    const result = item.run();
    if (isPromiseLike(result)) {
      void result.catch((error) => {
        console.error("Failed to run command palette action:", error);
        showTransientToast("명령을 실행하지 못했습니다.", { tone: "error" });
      });
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />
        <Dialog.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="fixed left-1/2 top-[12vh] z-50 flex max-h-[76vh] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 flex-col rounded-md border border-border-color bg-bg-panel p-3 text-text-primary shadow-2xl focus:outline-none"
        >
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search commands and run the selected command.
          </Dialog.Description>
          <div className="flex items-center gap-2 rounded-md border border-border-color bg-bg-primary px-3 py-2">
            <Command size={17} className="shrink-0 text-accent-color" />
            <input
              ref={inputRef}
              role="combobox"
              aria-label="Command"
              aria-expanded={isOpen}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSelectedIndex((current) =>
                    moveCommandPaletteSelection(current, 1, filteredItems.length)
                  );
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelectedIndex((current) =>
                    moveCommandPaletteSelection(current, -1, filteredItems.length)
                  );
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  runCommand(selectedItem);
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
              placeholder="Type a command"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="mt-3 max-h-[58vh] overflow-y-auto pr-1">
            {filteredItems.length > 0 ? (
              <div className="space-y-1">
                {filteredItems.map((item, index) => (
                  <CommandRow
                    key={item.id}
                    item={item}
                    isActive={index === selectedIndex}
                    onRun={runCommand}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-border-color bg-bg-primary px-3 py-8 text-center text-sm text-text-secondary">
                No matching commands
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
