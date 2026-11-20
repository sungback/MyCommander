import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { usePanelStore } from "../store/panelStore";
import { showTransientToast } from "../store/toastStore";
import type { PanelState } from "../types/file";
import { writeClipboardText } from "../utils/clipboard";
import {
  findSameExtensionPaths,
  formatSelectionForClipboard,
  matchSelectionLines,
  serializeSelectionFile,
  type SelectionClipboardMode,
} from "../utils/selectionText";

export type SelectionCommandId =
  | "select-same-extension"
  | "save-selection"
  | "restore-selection"
  | "save-selection-to-file"
  | "load-selection-from-file"
  | "copy-selected-names"
  | "copy-selected-paths"
  | "copy-selected-details"
  | "copy-selected-path-details";

const SELECTION_COMMAND_IDS: readonly SelectionCommandId[] = [
  "select-same-extension",
  "save-selection",
  "restore-selection",
  "save-selection-to-file",
  "load-selection-from-file",
  "copy-selected-names",
  "copy-selected-paths",
  "copy-selected-details",
  "copy-selected-path-details",
];

export const isSelectionCommandId = (value: unknown): value is SelectionCommandId =>
  typeof value === "string" && (SELECTION_COMMAND_IDS as readonly string[]).includes(value);

const CLIPBOARD_MODES: Partial<Record<SelectionCommandId, SelectionClipboardMode>> = {
  "copy-selected-names": "names",
  "copy-selected-paths": "paths",
  "copy-selected-details": "details",
  "copy-selected-path-details": "pathDetails",
};

// 저장한 선택은 앱 실행 중에만 유지한다.
let savedSelectionPaths: string[] = [];

export const resetSavedSelection = () => {
  savedSelectionPaths = [];
};

const getActivePanel = () => {
  const state = usePanelStore.getState();
  const panelId = state.activePanel;
  const panel: PanelState = panelId === "left" ? state.leftPanel : state.rightPanel;
  return { panelId, panel, setSelection: state.setSelection };
};

// 선택 항목이 없으면 커서 항목을 대상으로 한다.
const getTargetPaths = (panel: PanelState): string[] => {
  const selected = Array.from(panel.selectedItems);
  if (selected.length > 0) {
    return selected;
  }
  const cursorEntry = panel.files[panel.cursorIndex];
  return cursorEntry && cursorEntry.name !== ".." ? [cursorEntry.path] : [];
};

const selectSameExtension = () => {
  const { panelId, panel, setSelection } = getActivePanel();
  const result = findSameExtensionPaths(panel.files, panel.files[panel.cursorIndex]);
  if (!result) {
    showTransientToast("파일 위에 커서를 두고 실행하세요.", { tone: "error" });
    return;
  }

  setSelection(panelId, Array.from(new Set([...panel.selectedItems, ...result.paths])));
  const label = result.extension ? `.${result.extension}` : "확장자 없음";
  showTransientToast(`${label} 파일 ${result.paths.length}개 선택됨`);
};

const saveSelection = () => {
  const { panel } = getActivePanel();
  if (panel.selectedItems.size === 0) {
    showTransientToast("저장할 선택 항목이 없습니다.", { tone: "error" });
    return;
  }
  savedSelectionPaths = Array.from(panel.selectedItems);
  showTransientToast(`선택 ${savedSelectionPaths.length}개 저장됨`);
};

const restoreSelection = () => {
  if (savedSelectionPaths.length === 0) {
    showTransientToast("저장된 선택이 없습니다.", { tone: "error" });
    return;
  }
  const { panelId, panel, setSelection } = getActivePanel();
  const saved = new Set(savedSelectionPaths.map((path) => path.normalize("NFC")));
  const paths = panel.files
    .filter((file) => file.name !== ".." && saved.has(file.path.normalize("NFC")))
    .map((file) => file.path);
  setSelection(panelId, paths);
  showTransientToast(`선택 ${paths.length}개 복원됨`);
};

const saveSelectionToFile = async () => {
  const { panel } = getActivePanel();
  if (panel.selectedItems.size === 0) {
    showTransientToast("저장할 선택 항목이 없습니다.", { tone: "error" });
    return;
  }

  try {
    const target = await save({
      title: "선택을 파일로 저장",
      defaultPath: "selection.txt",
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (!target) {
      return;
    }
    await writeTextFile(target, serializeSelectionFile(Array.from(panel.selectedItems)));
    showTransientToast(`선택 ${panel.selectedItems.size}개를 파일로 저장했습니다.`);
  } catch (error) {
    console.error("Failed to save selection file:", error);
    showTransientToast("선택을 파일로 저장하지 못했습니다.", { tone: "error" });
  }
};

const loadSelectionFromFile = async () => {
  try {
    const source = await open({
      title: "선택을 파일에서 불러오기",
      multiple: false,
      directory: false,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (typeof source !== "string") {
      return;
    }
    const text = await readTextFile(source);
    // 파일 선택 중 패널이 바뀌었을 수 있어 읽은 뒤의 활성 패널을 쓴다.
    const { panelId, panel, setSelection } = getActivePanel();
    const paths = matchSelectionLines(panel.files, text);
    setSelection(panelId, paths);
    showTransientToast(`선택 ${paths.length}개 불러옴`);
  } catch (error) {
    console.error("Failed to load selection file:", error);
    showTransientToast("선택 파일을 불러오지 못했습니다.", { tone: "error" });
  }
};

const copySelectionText = async (mode: SelectionClipboardMode) => {
  const { panel } = getActivePanel();
  const paths = getTargetPaths(panel);
  if (paths.length === 0) {
    showTransientToast("복사할 항목이 없습니다.", { tone: "error" });
    return;
  }

  try {
    await writeClipboardText(formatSelectionForClipboard(panel.files, paths, mode));
    showTransientToast(`${paths.length}개 항목 정보를 복사했습니다.`);
  } catch (error) {
    console.error("Failed to copy selection text:", error);
    showTransientToast("클립보드를 사용할 수 없습니다.", { tone: "error" });
  }
};

export const runSelectionCommand = async (id: SelectionCommandId): Promise<void> => {
  switch (id) {
    case "select-same-extension":
      return selectSameExtension();
    case "save-selection":
      return saveSelection();
    case "restore-selection":
      return restoreSelection();
    case "save-selection-to-file":
      return saveSelectionToFile();
    case "load-selection-from-file":
      return loadSelectionFromFile();
    default: {
      const mode = CLIPBOARD_MODES[id];
      if (mode) {
        return copySelectionText(mode);
      }
    }
  }
};
