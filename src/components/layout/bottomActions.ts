import type { LucideIcon } from "lucide-react";
import {
  Copy,
  Eye,
  FilePenLine,
  FolderPlus,
  MoveRight,
  Power,
  Search,
  Trash2,
} from "lucide-react";

export const BOTTOM_ACTION_COUNT = 8;

export type BottomActionCommand =
  | "openPreview"
  | "openEditor"
  | "openCopy"
  | "openMove"
  | "openMkdir"
  | "openDelete"
  | "openSearch"
  | "closeApp";

export interface BottomActionDefinition {
  id: string;
  keyLabel: string;
  title: string;
  icon: LucideIcon;
  command: BottomActionCommand;
}

const assertBottomActionCount = (actions: BottomActionDefinition[]) => {
  if (actions.length !== BOTTOM_ACTION_COUNT) {
    throw new Error(
      `Bottom action count must stay at ${BOTTOM_ACTION_COUNT}; received ${actions.length}.`
    );
  }

  return actions;
};

export const createBottomActionDefinitions = (
  isMac: boolean
): BottomActionDefinition[] =>
  assertBottomActionCount([
    { id: "preview", keyLabel: "F3", title: "보기", icon: Eye, command: "openPreview" },
    { id: "edit", keyLabel: "F4", title: "편집", icon: FilePenLine, command: "openEditor" },
    { id: "copy", keyLabel: "F5", title: "복사", icon: Copy, command: "openCopy" },
    { id: "move", keyLabel: "F6", title: "이동", icon: MoveRight, command: "openMove" },
    { id: "mkdir", keyLabel: "F7", title: "새 폴더", icon: FolderPlus, command: "openMkdir" },
    { id: "delete", keyLabel: "F8", title: "삭제", icon: Trash2, command: "openDelete" },
    {
      id: "search",
      keyLabel: isMac ? "Option+F7" : "Alt+F7",
      title: "검색",
      icon: Search,
      command: "openSearch",
    },
    {
      id: "quit",
      keyLabel: isMac ? "Cmd+Q" : "Alt+F4",
      title: "종료",
      icon: Power,
      command: "closeApp",
    },
  ]);
