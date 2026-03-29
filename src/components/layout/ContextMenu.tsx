import React, { useEffect, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useContextMenuStore } from "../../store/contextMenuStore";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { FileEntry } from "../../types/file";
import {
  ClipboardCopy,
  FilePlus2,
  FolderPlus,
  Info,
  Search,
  Terminal,
} from "lucide-react";
import { useFileSystem } from "../../hooks/useFileSystem";

const MENU_ITEM_CLASS =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[15px] font-medium text-white/94 transition-colors hover:bg-white/7";

const DISABLED_MENU_ITEM_CLASS =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[15px] font-medium text-white/40 cursor-not-allowed";

const MENU_ICON_CLASS = "h-[15px] w-[15px] shrink-0 text-white/70";

const ContextMenuSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2 py-1">{children}</div>
);

const ContextMenuDivider: React.FC = () => (
  <div className="mx-3 h-px bg-white/10" />
);

export const ContextMenu: React.FC = () => {
  const { isOpen, panelId, targetPath, x, y, closeContextMenu } = useContextMenuStore();
  const setOpenDialog = useDialogStore((s) => s.setOpenDialog);
  const openInfoDialog = useDialogStore((s) => s.openInfoDialog);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const fs = useFileSystem();
  const leftPanel = usePanelStore((s) => s.leftPanel);
  const rightPanel = usePanelStore((s) => s.rightPanel);

  const panel = panelId === "left" ? leftPanel : panelId === "right" ? rightPanel : null;
  const [feedbackLabel, setFeedbackLabel] = useState<string | null>(null);
  const targetEntry: FileEntry | null =
    panel && targetPath
      ? panel.files.find((entry) => entry.path.normalize("NFC") === targetPath.normalize("NFC")) ?? null
      : null;
  const hasTargetItem = Boolean(targetPath);
  const targetLabel =
    targetEntry?.name ??
    targetPath?.split(/[\\/]/).filter(Boolean).pop() ??
    targetPath ??
    "";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClose = () => closeContextMenu();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };
    window.addEventListener("click", handleClose);
    window.addEventListener("contextmenu", handleClose);
    window.addEventListener("resize", handleClose);
    window.addEventListener("blur", handleClose);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("contextmenu", handleClose);
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("blur", handleClose);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeContextMenu, isOpen]);

  useEffect(() => {
    if (!feedbackLabel) {
      return;
    }

    const timeoutId = window.setTimeout(() => setFeedbackLabel(null), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [feedbackLabel]);

  if (!isOpen || !panelId || !panel) {
    return null;
  }

  const openDialogForPanel = (dialog: "copy" | "move" | "delete" | "mkdir" | "newfile" | "search") => {
    setActivePanel(panelId);
    setOpenDialog(dialog);
    closeContextMenu();
  };

  const handleRefresh = () => {
    refreshPanel(panelId);
    closeContextMenu();
  };

  const handleInfo = () => {
    if (!targetPath) {
      return;
    }

    setActivePanel(panelId);
    openInfoDialog({ panelId, path: targetPath });
    closeContextMenu();
  };

  const handleRevealInFinder = async () => {
    const revealTarget = targetPath ?? panel.currentPath;
    try {
      await revealItemInDir(revealTarget);
      closeContextMenu();
    } catch (error) {
      console.error(error);
      setFeedbackLabel("Could not reveal item.");
    }
  };

  const handleCopyPath = async () => {
    const text = targetPath ?? panel.currentPath;
    try {
      await navigator.clipboard.writeText(text);
      setFeedbackLabel("Path copied");
      closeContextMenu();
    } catch (error) {
      console.error(error);
      setFeedbackLabel("Clipboard unavailable");
    }
  };

  const handleOpenInTerminal = async () => {
    const terminalTarget = targetPath ?? panel.currentPath;
    try {
      await fs.openInTerminal(terminalTarget);
      closeContextMenu();
    } catch (error) {
      console.error(error);
      setFeedbackLabel("Could not open Terminal.");
    }
  };

  const menuX = Math.min(x, window.innerWidth - 220);
  const menuY = Math.min(y, window.innerHeight - 360);

  return (
    <div
      className="fixed z-[80] min-w-[250px] overflow-hidden rounded-[18px] border border-white/12 bg-[#1e2526]/96 text-text-primary shadow-[0_28px_60px_rgba(0,0,0,0.46)] backdrop-blur-md"
      style={{ left: menuX, top: menuY }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {hasTargetItem ? (
        <>
          <ContextMenuSection>
            <div className="truncate px-3 py-2 text-[12px] font-medium uppercase tracking-[0.14em] text-white/42">
              {targetLabel}
            </div>
            <button className={MENU_ITEM_CLASS} onClick={handleInfo}>
              <Info className={MENU_ICON_CLASS} />
              <span>Get Info</span>
            </button>
            <button className={MENU_ITEM_CLASS} onClick={handleRevealInFinder}>
              <Search className={MENU_ICON_CLASS} />
              <span>Reveal in Finder</span>
            </button>
            <button className={MENU_ITEM_CLASS} onClick={handleOpenInTerminal}>
              <Terminal className={MENU_ICON_CLASS} />
              <span>Open in Terminal</span>
            </button>
            <button className={DISABLED_MENU_ITEM_CLASS} disabled>
              <span className="h-[15px] w-[15px] shrink-0 text-center">+</span>
              <span>Paste</span>
            </button>
            <button className={MENU_ITEM_CLASS} onClick={handleCopyPath}>
              <ClipboardCopy className={MENU_ICON_CLASS} />
              <span>Copy Path to Clipboard</span>
            </button>
          </ContextMenuSection>
          <ContextMenuDivider />
          <ContextMenuSection>
            <button className={MENU_ITEM_CLASS} onClick={() => openDialogForPanel("copy")}>
              <ClipboardCopy className={MENU_ICON_CLASS} />
              <span>Copy</span>
            </button>
            <button className={MENU_ITEM_CLASS} onClick={() => openDialogForPanel("move")}>
              <Search className={MENU_ICON_CLASS} />
              <span>Move</span>
            </button>
            <button className={MENU_ITEM_CLASS} onClick={() => openDialogForPanel("delete")}>
              <span className="h-[15px] w-[15px] shrink-0 text-center text-white/70">-</span>
              <span>Delete</span>
            </button>
            <button className={MENU_ITEM_CLASS} onClick={handleRefresh}>
              <span className="h-[15px] w-[15px] shrink-0 text-center text-white/70">R</span>
              <span>Refresh</span>
            </button>
          </ContextMenuSection>
        </>
      ) : (
        <>
          <ContextMenuSection>
            <button className={MENU_ITEM_CLASS} onClick={() => openDialogForPanel("mkdir")}>
              <FolderPlus className={MENU_ICON_CLASS} />
              <span>New Folder</span>
            </button>
            <button className={MENU_ITEM_CLASS} onClick={() => openDialogForPanel("newfile")}>
              <FilePlus2 className={MENU_ICON_CLASS} />
              <span>New File</span>
            </button>
          </ContextMenuSection>
          <ContextMenuDivider />
          <ContextMenuSection>
            <button className={MENU_ITEM_CLASS} onClick={handleRevealInFinder}>
              <Search className={MENU_ICON_CLASS} />
              <span>Reveal in Finder</span>
            </button>
            <button className={MENU_ITEM_CLASS} onClick={handleOpenInTerminal}>
              <Terminal className={MENU_ICON_CLASS} />
              <span>Open in Terminal</span>
            </button>
            <button className={MENU_ITEM_CLASS} onClick={handleCopyPath}>
              <ClipboardCopy className={MENU_ICON_CLASS} />
              <span>Copy Path to Clipboard</span>
            </button>
          </ContextMenuSection>
          <ContextMenuDivider />
          <ContextMenuSection>
            <button className={MENU_ITEM_CLASS} onClick={() => openDialogForPanel("search")}>
              <Search className={MENU_ICON_CLASS} />
              <span>Search Here</span>
            </button>
          </ContextMenuSection>
        </>
      )}
      {feedbackLabel ? (
        <>
          <ContextMenuDivider />
          <div className="px-4 py-2 text-xs text-white/60">{feedbackLabel}</div>
        </>
      ) : null}
    </div>
  );
};
