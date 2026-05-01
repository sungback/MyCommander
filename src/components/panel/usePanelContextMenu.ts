import { useEffect, type RefObject } from "react";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import { useContextMenuStore } from "../../store/contextMenuStore";
import type { FileEntry, PanelId } from "../../types/file";
import {
  findFileEntryElement,
  getFileEntryIndex,
  readFileEntryFromElement,
} from "./fileEntryElement";

interface UsePanelContextMenuProps {
  files: FileEntry[];
  panelId: PanelId;
  panelRef: RefObject<HTMLDivElement | null>;
  selectOnly: (panel: PanelId, path: string | null) => void;
  selectedItems: Set<string>;
  setActivePanel: (panel: PanelId) => void;
  setCursor: (panel: PanelId, index: number) => void;
}

const getContextMenuSelectionCount = (
  selectedItems: Set<string>,
  targetPath: string | null
) => {
  if (!targetPath) {
    return selectedItems.size;
  }

  return selectedItems.has(targetPath) ? selectedItems.size : 1;
};

const findContextMenuTargetEntry = (
  files: FileEntry[],
  entryElement: HTMLElement | null,
  entryPath: string | null
) => {
  if (!entryPath) {
    return null;
  }

  return (
    files.find(
      (entry) => entry.path.normalize("NFC") === entryPath.normalize("NFC")
    ) ??
    readFileEntryFromElement(entryElement)
  );
};

export const usePanelContextMenu = ({
  files,
  panelId,
  panelRef,
  selectOnly,
  selectedItems,
  setActivePanel,
  setCursor,
}: UsePanelContextMenuProps) => {
  const fs = useFileSystem();
  const openContextMenu = useContextMenuStore((state) => state.openContextMenu);

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

      setActivePanel(panelId);

      const entryElement = findFileEntryElement(target);
      const entryPath = entryElement?.dataset.entryPath ?? null;
      const entryIndex = getFileEntryIndex(entryElement);
      const targetWasSelected = entryPath
        ? selectedItems.has(entryPath)
        : false;

      if (entryPath) {
        if (entryIndex !== null && Number.isFinite(entryIndex)) {
          setCursor(panelId, entryIndex);
        }

        if (!targetWasSelected) {
          selectOnly(panelId, entryPath);
        }
      }

      const targetEntry = findContextMenuTargetEntry(
        files,
        entryElement,
        entryPath
      );

      openContextMenu({
        panelId,
        targetPath: entryPath,
        targetEntry,
        x: event.clientX,
        y: event.clientY,
      });

      const selectedCount = getContextMenuSelectionCount(
        selectedItems,
        entryPath
      );
      const canCreateZip = Boolean(
        targetEntry &&
          targetEntry.name !== ".." &&
          (targetEntry.kind === "directory" || selectedCount > 1)
      );
      const canExtractZip = Boolean(
        targetEntry &&
          targetEntry.kind === "file" &&
          targetEntry.name.toLowerCase().endsWith(".zip")
      );

      void fs
        .showContextMenu({
          x: event.clientX,
          y: event.clientY,
          hasTargetItem: entryPath !== null,
          canRename: Boolean(targetEntry && targetEntry.name !== ".."),
          canCreateZip,
          canExtractZip,
        })
        .catch((error) => {
          console.error("Failed to show context menu:", error);
          window.alert(getErrorMessage(error, "컨텍스트 메뉴를 열지 못했습니다."));
        });
    };

    panelElement.addEventListener("contextmenu", handleContextMenu, true);
    return () => {
      panelElement.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [
    files,
    fs,
    openContextMenu,
    panelId,
    panelRef,
    selectOnly,
    selectedItems,
    setActivePanel,
    setCursor,
  ]);
};
