import React, { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePanelStore } from "../../store/panelStore";
import { AddressBar } from "./AddressBar";
import { ColumnHeader } from "./ColumnHeader";
import { FileList } from "./FileList";
import { clsx } from "clsx";
import { DriveList } from "./DriveList";
import { TabBar } from "./TabBar";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import { getParentPath } from "../../utils/path";
import { useContextMenuStore } from "../../store/contextMenuStore";
import { enterArchiveEntry, isArchiveEntry, isZipArchiveEntry } from "./archiveEnter";

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
  const viewMode = usePanelStore((s) => s.panelViewModes[id]);
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
    let cancelled = false;
    let activePath = panelState.currentPath;

    const loadDir = async () => {
      const resolveHomeDirectory = async () => {
        const home = await fs.getHomeDir();
        if (cancelled) {
          return home;
        }
        activePath = home;
        setPath(id, home);
        return home;
      };

      try {
        // Only replace the generic root placeholder. Windows drive roots are real targets.
        if (activePath === "/") {
          await resolveHomeDirectory();
        }

        const entries = await fs.listDirectory(activePath, showHiddenFiles);
        if (cancelled) {
          return;
        }
        setFiles(id, entries);
      } catch (err) {
        if (cancelled) {
          return;
        }
        try {
          const home = await resolveHomeDirectory();
          if (cancelled) {
            return;
          }
          const entries = await fs.listDirectory(home, showHiddenFiles);
          if (cancelled) {
            return;
          }
          setFiles(id, entries);
        } catch (fallbackError) {
          if (cancelled) {
            return;
          }
          console.error("Failed loading dir: ", err);
          console.error("Failed loading fallback home dir: ", fallbackError);
        }
      }
    };

    void loadDir();

    return () => {
      cancelled = true;
    };
  }, [
    fs,
    id,
    panelState.activeTabId,
    panelState.currentPath,
    panelState.lastUpdated,
    setFiles,
    setPath,
    showHiddenFiles,
  ]);

  useEffect(() => {
    backgroundSchedulerRef.current = {
      activeCount: 0,
      queue: [],
      queuedPaths: new Set(),
    };
  }, [id, panelState.activeTabId, panelState.currentPath]);

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

      const targetEntry =
        entryPath !== null
          ? panelState.files.find(
              (entry) => entry.path.normalize("NFC") === entryPath.normalize("NFC")
            ) ?? null
          : null;

      openContextMenu({
        panelId: id,
        targetPath: entryPath,
        x: event.clientX,
        y: event.clientY,
      });

      void invoke("show_context_menu", {
        request: {
          x: event.clientX,
          y: event.clientY,
          has_target_item: entryPath !== null,
          can_rename: Boolean(targetEntry && targetEntry.name !== ".."),
          can_create_zip: Boolean(
            targetEntry && targetEntry.kind === "directory" && targetEntry.name !== ".."
          ),
        },
      }).catch((error) => {
        console.error("Failed to show context menu:", error);
        window.alert(getErrorMessage(error, "컨텍스트 메뉴를 열지 못했습니다."));
      });
    };

    panelElement.addEventListener("contextmenu", handleContextMenu, true);
    return () => {
      panelElement.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [id, openContextMenu, panelState.selectedItems, selectOnly, setActivePanel, setCursor]);

  const handleEnter = async (entry: any) => {
    if (entry.kind === "directory") {
      if (entry.name === "..") {
        setPath(id, getParentPath(panelState.currentPath));
      } else {
        setPath(id, entry.path);
      }
    } else {
      const isZipArchive = isZipArchiveEntry(entry);

      if (!isArchiveEntry(entry)) {
        console.log("Cannot enter file, need to open:", entry.path);
        return;
      }

      try {
        const handled = await enterArchiveEntry({
          entry,
          fs,
          panelId: id,
          setPath,
        });

        if (!handled) {
          console.log("Cannot enter file, need to open:", entry.path);
          return;
        }
      } catch (error) {
        console.error("Failed to open archive file:", error);
        window.alert(
          getErrorMessage(
            error,
            isZipArchive
              ? "Failed to extract zip archive."
              : "Failed to open disk image."
          )
        );
      }
    }
  };

  return (
    <div
      ref={panelRef}
      className={clsx(
        "flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-opacity bg-bg-panel"
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
      {viewMode === "detailed" ? (
        <ColumnHeader
          sortField={panelState.sortField}
          sortDirection={panelState.sortDirection}
          onSort={(field) => usePanelStore.getState().setSort(id, field)}
        />
      ) : null}
      <FileList
        currentPath={panelState.currentPath}
        files={panelState.files}
        selectedItems={panelState.selectedItems}
        cursorIndex={panelState.cursorIndex}
        isActivePanel={isActive}
        panelId={id}
        viewMode={viewMode}
        onSelect={(path, _toggle) => toggleSelection(id, path)}
        onEnter={handleEnter}
        setCursorIndex={(idx) => setCursor(id, idx)}
      />
    </div>
  );
};
