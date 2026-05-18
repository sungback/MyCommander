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
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDialogStore } from "../../store/dialogStore";
import {
  getFrequentLocations,
  getRecentLocations,
  useLocationHistoryStore,
} from "../../store/locationHistoryStore";
import { useFileOperationUndoStore } from "../../store/fileOperationUndoStore";
import { usePanelStore } from "../../store/panelStore";
import { showTransientToast } from "../../store/toastStore";
import { isMacPlatform } from "../../hooks/useAppCommands";
import {
  buildCommandPaletteItems,
  filterCommandPaletteItems,
  getPrimaryCommandTarget,
  getSelectedCommandPaths,
  moveCommandPaletteSelection,
  type CommandPaletteItem,
  type CommandPaletteLocation,
} from "./commandPaletteActions";
import { useCommandPaletteActions } from "./useCommandPaletteActions";

const ITEM_ICONS: Record<string, LucideIcon> = {
  "command-palette": Command,
  preview: Eye,
  edit: FilePenLine,
  copy: Copy,
  move: MoveRight,
  delete: Trash2,
  rename: FilePenLine,
  "undo-file-operation": Undo2,
  "new-file": FilePlus,
  "new-folder": FolderPlus,
  search: Search,
  "compare-folders": ListChecks,
  "sync-other-panel": PanelsLeftRight,
  "calculate-folder-sizes": ListChecks,
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
  const activePanelId = usePanelStore((state) => state.activePanel);
  const leftPanel = usePanelStore((state) => state.leftPanel);
  const rightPanel = usePanelStore((state) => state.rightPanel);
  const showHiddenFiles = usePanelStore((state) => state.showHiddenFiles);
  const locations = useLocationHistoryStore((state) => state.locations);
  const lastUndoOperation = useFileOperationUndoStore(
    (state) => state.lastOperation
  );
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

  const actions = useCommandPaletteActions();

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
        undoOperation: lastUndoOperation,
      }),
    [
      actions,
      activePanel,
      activePanelId,
      isMac,
      commandLocations,
      lastUndoOperation,
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
