import { useDialogStore } from "../store/dialogStore";
import { usePanelStore } from "../store/panelStore";
import { useClipboardStore, ClipboardState } from "../store/clipboardStore";
import { showTransientToast } from "../store/toastStore";
import { findFileEntryByPath } from "../components/panel/fileEntryElement";
import { writeClipboardText } from "../utils/clipboard";
import {
  arePanelAccessPathsEquivalent,
  getPanelAccessPath,
} from "../utils/panelPath";
import { runNfcRename } from "../features/normalizeFilenamesToNfc";
import { runSelectionCommand } from "../features/selectionCommands";
import { isMacPlatform } from "../utils/platform";
import { getErrorMessage, useFileSystem } from "./useFileSystem";

export { isMacPlatform };

const getPrimaryTarget = () => {
  const state = usePanelStore.getState();
  const panel = state.activePanel === "left" ? state.leftPanel : state.rightPanel;
  const selectedPath = Array.from(panel.selectedItems)[0];
  if (selectedPath) {
    // 펼친 하위 항목은 panel.files에 없으므로 화면 DOM에서 종류를 찾는다.
    const selectedEntry =
      panel.files.find(
        (entry) => entry.path.normalize("NFC") === selectedPath.normalize("NFC")
      ) ?? findFileEntryByPath(selectedPath);
    return { path: selectedPath, kind: selectedEntry?.kind, entry: selectedEntry ?? undefined };
  }

  const cursorEntry = panel.files[panel.cursorIndex];
  if (!cursorEntry || cursorEntry.name === "..") {
    return null;
  }

  return { path: cursorEntry.path, kind: cursorEntry.kind, entry: cursorEntry };
};


export const showTransientStatusMessage = (message: string, durationMs: number = 1400) => {
  showTransientToast(message, { durationMs });
};

export function useAppCommands() {
  const setOpenDialog = useDialogStore((s) => s.setOpenDialog);
  const openPasteDialog = useDialogStore((s) => s.openPasteDialog);
  const openPreviewDialog = useDialogStore((s) => s.openPreviewDialog);
  const openRenameDialog = useDialogStore((s) => s.openRenameDialog);
  const openDialog = useDialogStore((s) => s.openDialog);
  const fs = useFileSystem();

  // 미리보기 대화상자는 대상 파일(dialogTarget)이 있어야 열리므로 선택 항목이나 커서 항목을 넘긴다.
  const openPreview = () => {
    const target = getPrimaryTarget();
    if (!target) {
      showTransientStatusMessage("선택된 항목이 없습니다");
      return;
    }
    // 폴더는 읽을 파일 내용이 없어 미리보기를 열면 "Is a directory" 오류가 난다.
    if (target.kind === "directory") {
      showTransientStatusMessage("폴더는 미리보기를 지원하지 않습니다");
      return;
    }
    openPreviewDialog({ panelId: usePanelStore.getState().activePanel, path: target.path });
  };
  // 선택 항목 하나(없으면 커서 항목)의 이름을 바꾼다. 여러 항목은 일괄 이름 변경 도구를 안내한다.
  const openRename = () => {
    const state = usePanelStore.getState();
    const panel = state.activePanel === "left" ? state.leftPanel : state.rightPanel;
    if (panel.selectedItems.size > 1) {
      showTransientStatusMessage("여러 항목은 일괄 이름 변경 도구로 바꿀 수 있습니다");
      return;
    }
    const target = getPrimaryTarget();
    if (!target) {
      showTransientStatusMessage("선택된 항목이 없습니다");
      return;
    }
    openRenameDialog({ panelId: state.activePanel, path: target.path, entry: target.entry });
  };
  // 대상이 없으면(빈 폴더, ".." 위) 0개 항목 대화상자 대신 안내만 한다.
  const openWithTargets = (dialog: "copy" | "move" | "delete" | "permanentDelete") => {
    if (getActiveSelectedPaths().length === 0) {
      showTransientStatusMessage("선택된 항목이 없습니다");
      return;
    }
    setOpenDialog(dialog);
  };
  const openCopy = () => openWithTargets("copy");
  const openMove = () => openWithTargets("move");
  const openMkdir = () => setOpenDialog("mkdir");
  const openNewFile = () => setOpenDialog("newfile");
  const openDelete = () => openWithTargets("delete");
  const openPermanentDelete = () => openWithTargets("permanentDelete");
  const openSearch = () => setOpenDialog("search");
  const openSync = () => setOpenDialog("sync");
  const openCommandPalette = () => setOpenDialog("commandPalette");
  const openWildcardSelect = (mode: "select" | "unselect" = "select") =>
    useDialogStore.getState().openWildcardDialog(mode);
  const invertSelection = () => {
    const state = usePanelStore.getState();
    state.invertSelection(state.activePanel);
  };
  const swapPanels = () => usePanelStore.getState().swapPanels();

  const openEditor = async () => {
    const target = getPrimaryTarget();
    if (!target) {
      showTransientStatusMessage("선택된 항목이 없습니다");
      return;
    }
    // 폴더는 편집할 수 없으므로 시스템 알림 대신 토스트로 안내한다.
    if (target.kind === "directory") {
      showTransientStatusMessage("폴더는 편집할 수 없습니다");
      return;
    }

    try {
      await fs.openInEditor(target.path);
    } catch (error) {
      console.error("Failed to open editor:", error);
      window.alert(getErrorMessage(error, "Failed to open the editor."));
    }
  };

  const closeApp = async () => {
    try {
      await fs.quitApp();
    } catch (error) {
      console.error("Failed to quit app:", error);
    }
  };

  const syncOtherPanelToCurrentPath = (sourcePanelId?: "left" | "right") => {
    const state = usePanelStore.getState();
    const resolvedSourcePanelId = sourcePanelId ?? state.activePanel;
    const targetPanelId = resolvedSourcePanelId === "left" ? "right" : "left";
    const sourcePanel =
      resolvedSourcePanelId === "left" ? state.leftPanel : state.rightPanel;
    const targetPanel = targetPanelId === "left" ? state.leftPanel : state.rightPanel;

    if (arePanelAccessPathsEquivalent(sourcePanel, targetPanel)) {
      return;
    }

    state.setPath(targetPanelId, sourcePanel.currentPath);
  };

  const copyCurrentPath = async (panelId?: "left" | "right") => {
    const state = usePanelStore.getState();
    const resolvedPanelId = panelId ?? state.activePanel;
    const panel = resolvedPanelId === "left" ? state.leftPanel : state.rightPanel;

    try {
      await writeClipboardText(panel.currentPath);
      showTransientStatusMessage("Path copied");
    } catch (error) {
      console.error("Failed to copy current path:", error);
      showTransientStatusMessage("Clipboard unavailable");
    }
  };

  const getActiveSelectedPaths = (): string[] => {
    const state = usePanelStore.getState();
    const panelId = state.activePanel;
    const panel = panelId === "left" ? state.leftPanel : state.rightPanel;
    const selected = Array.from(panel.selectedItems);
    if (selected.length > 0) return selected;
    const cursor = panel.files[panel.cursorIndex];
    if (cursor && cursor.name !== "..") return [cursor.path];
    return [];
  };

  const normalizeSelectionToNfc = async () => {
    const paths = getActiveSelectedPaths();
    if (paths.length === 0) {
      showTransientStatusMessage("변환할 항목이 없습니다");
      return;
    }

    await runNfcRename(paths, fs.renameFile);
  };

  const copyToClipboard = async () => {
    const paths = getActiveSelectedPaths();
    if (paths.length === 0) return;

    const state = usePanelStore.getState();
    const clipState: ClipboardState = {
      paths,
      operation: "copy",
      sourcePanel: state.activePanel,
    };
    useClipboardStore.getState().setClipboard(clipState);

    try {
      await fs.writeFilesToPasteboard(paths, "copy");
    } catch (e) {
      console.error("Failed to write to pasteboard:", e);
    }

    showTransientStatusMessage(`${paths.length}개 항목 복사됨`);
  };

  const cutToClipboard = async () => {
    const paths = getActiveSelectedPaths();
    if (paths.length === 0) return;

    const state = usePanelStore.getState();
    const clipState: ClipboardState = {
      paths,
      operation: "cut",
      sourcePanel: state.activePanel,
    };
    useClipboardStore.getState().setClipboard(clipState);

    try {
      await fs.writeFilesToPasteboard(paths, "cut");
    } catch (e) {
      console.error("Failed to write to pasteboard:", e);
    }

    showTransientStatusMessage(`${paths.length}개 항목 잘라내기됨`);
  };

  const pasteFromClipboard = () => {
    const state = usePanelStore.getState();
    const clipboard = useClipboardStore.getState().clipboard;
    if (!clipboard) return;

    const activePanel = state.activePanel;
    const panel = activePanel === "left" ? state.leftPanel : state.rightPanel;

    // 같은 폴더로 cut 이동은 의미 없음
    if (clipboard.operation === "cut") {
      const sourcePaths = clipboard.paths;
      const sameFolder = sourcePaths.every((p) => {
        const parent = p.substring(0, p.lastIndexOf("/")) || p.substring(0, p.lastIndexOf("\\"));
        return parent === getPanelAccessPath(panel);
      });
      if (sameFolder) {
        showTransientStatusMessage("이미 같은 위치에 있습니다");
        return;
      }
    }

    if (clipboard.operation === "copy") {
      openPasteDialog("copy");
    } else {
      openPasteDialog("move");
    }
  };

  const runCommandInCurrentPath = async (command: string, panelId?: "left" | "right") => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      showTransientStatusMessage("Command is empty");
      return;
    }

    const state = usePanelStore.getState();
    const resolvedPanelId = panelId ?? state.activePanel;
    const panel = resolvedPanelId === "left" ? state.leftPanel : state.rightPanel;

    try {
      await fs.runShellCommand(getPanelAccessPath(panel), trimmedCommand);
      showTransientStatusMessage("Command started");
    } catch (error) {
      console.error("Failed to run command:", error);
      window.alert(getErrorMessage(error, "Failed to run the command."));
    }
  };

  return {
    openDialog,
    openPreview,
    openRename,
    openEditor,
    openCopy,
    openMove,
    openMkdir,
    openNewFile,
    openDelete,
    openPermanentDelete,
    openSearch,
    openSync,
    openCommandPalette,
    openWildcardSelect,
    invertSelection,
    runSelectionCommand,
    swapPanels,
    closeApp,
    syncOtherPanelToCurrentPath,
    copyCurrentPath,
    normalizeSelectionToNfc,
    runCommandInCurrentPath,
    copyToClipboard,
    cutToClipboard,
    pasteFromClipboard,
  };
}
