import React, { useEffect, useRef } from "react";
import { usePanelStore } from "../../store/panelStore";
import { AddressBar } from "./AddressBar";
import { ColumnHeader } from "./ColumnHeader";
import { FileList } from "./FileList";
import { clsx } from "clsx";

import { DriveList } from "./DriveList";
import { TabBar } from "./TabBar";
import { useFileSystem } from "../../hooks/useFileSystem";
import { getParentPath } from "../../utils/path";
import { useContextMenuStore } from "../../store/contextMenuStore";

interface FilePanelProps {
  id: "left" | "right";
}

const MAX_BACKGROUND_DIR_SIZE_WORKERS = 2;

interface BackgroundSizeScheduler {
  activeCount: number;
  queue: Array<{ path: string }>;
  queuedPaths: Set<string>;
}

export const FilePanel: React.FC<FilePanelProps> = ({ id }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const panelState = usePanelStore((s) => id === "left" ? s.leftPanel : s.rightPanel);
  const activePanelId = usePanelStore((s) => s.activePanel);
  const showHiddenFiles = usePanelStore((s) => s.showHiddenFiles);
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const toggleSelection = usePanelStore((s) => s.toggleSelection);
  const setCursor = usePanelStore((s) => s.setCursor);
  const setPath = usePanelStore((s) => s.setPath);
  const setFiles = usePanelStore((s) => s.setFiles);
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const selectOnly = usePanelStore((s) => s.selectOnly);
  const openContextMenu = useContextMenuStore((s) => s.openContextMenu);
  const fs = useFileSystem();
  const backgroundSchedulerRef = useRef<BackgroundSizeScheduler>({
    activeCount: 0,
    queue: [],
    queuedPaths: new Set(),
  });

  const isActive = activePanelId === id;

  useEffect(() => {
    // Initial fetch
    let activePath = panelState.currentPath;

    const loadDir = async () => {
      const resolveHomeDirectory = async () => {
        const home = await fs.getHomeDir();
        activePath = home;
        setPath(id, home);
        return home;
      };

      try {
        // Correct initial path if it's the root placeholder or default Windows C:\
        if (activePath === "/" || activePath === "C:\\" || activePath === "D:\\") {
          await resolveHomeDirectory();
        }

        const entries = await fs.listDirectory(activePath, showHiddenFiles);
        setFiles(id, entries);
      } catch (err) {
        try {
          const home = await resolveHomeDirectory();
          const entries = await fs.listDirectory(home, showHiddenFiles);
          setFiles(id, entries);
        } catch (fallbackError) {
          console.error("Failed loading dir: ", err);
          console.error("Failed loading fallback home dir: ", fallbackError);
        }
      }
    };

    loadDir();
  }, [fs, id, panelState.currentPath, panelState.lastUpdated, setFiles, setPath, showHiddenFiles]);

  useEffect(() => {
    backgroundSchedulerRef.current = {
      activeCount: 0,
      queue: [],
      queuedPaths: new Set(),
    };
  }, [id, panelState.currentPath]);

  useEffect(() => {
    const scheduler = backgroundSchedulerRef.current;
    const pendingDirectories = panelState.files.filter(
      (entry) =>
        entry.kind === "directory" &&
        entry.name !== ".." &&
        (entry.size === undefined || entry.size === null) &&
        !scheduler.queuedPaths.has(entry.path)
    );

    if (pendingDirectories.length === 0) {
      return;
    }

    const drainQueue = () => {
      while (
        scheduler.activeCount < MAX_BACKGROUND_DIR_SIZE_WORKERS &&
        scheduler.queue.length > 0
      ) {
        const entry = scheduler.queue.shift();
        if (!entry) {
          return;
        }

        scheduler.activeCount += 1;

        void fs
          .getDirSize(entry.path)
          .then((size) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            updateEntrySize(id, entry.path, size);
          })
          .catch((error) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            console.error(`Failed to calculate background dir size for ${entry.path}:`, error);
          })
          .finally(() => {
            scheduler.queuedPaths.delete(entry.path);
            scheduler.activeCount -= 1;

            if (backgroundSchedulerRef.current === scheduler) {
              drainQueue();
            }
          });
      }
    };

    for (const entry of pendingDirectories) {
      scheduler.queue.push({ path: entry.path });
      scheduler.queuedPaths.add(entry.path);
    }

    drainQueue();
  }, [fs, id, panelState.files, panelState.currentPath, updateEntrySize]);

  useEffect(() => {
    const panelElement = panelRef.current;
    if (!panelElement) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      setActivePanel(id);

      const entryElement = target.closest<HTMLElement>("[data-entry-path]");
      const entryPath = entryElement?.dataset.entryPath ?? null;
      const entryIndex = entryElement?.dataset.entryIndex
        ? Number(entryElement.dataset.entryIndex)
        : null;

      if (entryPath) {
        if (entryIndex !== null && Number.isFinite(entryIndex)) {
          setCursor(id, entryIndex);
        }

        if (!panelState.selectedItems.has(entryPath)) {
          selectOnly(id, entryPath);
        }
      }

      openContextMenu({
        panelId: id,
        targetPath: entryPath,
        x: event.clientX,
        y: event.clientY,
      });
    };

    panelElement.addEventListener("contextmenu", handleContextMenu, true);
    return () => {
      panelElement.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [id, openContextMenu, panelState.selectedItems, selectOnly, setActivePanel, setCursor]);

  const handleEnter = (entry: any) => {
    if (entry.kind === "directory") {
      if (entry.name === "..") {
        setPath(id, getParentPath(panelState.currentPath));
      } else {
        setPath(id, entry.path);
      }
    } else {
      console.log("Cannot enter file, need to open:", entry.path);
    }
  };

  return (
    <div
      ref={panelRef}
      className={clsx(
        "flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-opacity bg-bg-panel",
        !isActive && "opacity-80 grayscale-20"
      )}
      onClickCapture={() => {
        if (!isActive) {
          setActivePanel(id);
        }
      }}
    >
      <DriveList panelId={id} />
      <TabBar panelId={id} />
      <AddressBar panelId={id} />
      <ColumnHeader
        sortField={panelState.sortField}
        sortDirection={panelState.sortDirection}
        onSort={(field) => usePanelStore.getState().setSort(id, field)}
      />
      <FileList
        currentPath={panelState.currentPath}
        files={panelState.files}
        selectedItems={panelState.selectedItems}
        cursorIndex={panelState.cursorIndex}
        isActivePanel={isActive}
        panelId={id}
        onSelect={(path, _toggle) => toggleSelection(id, path)}
        onEnter={handleEnter}
        setCursorIndex={(idx) => setCursor(id, idx)}
      />
    </div>
  );
};
