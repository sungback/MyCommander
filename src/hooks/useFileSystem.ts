import { archiveCommands } from "./tauriCommands/archiveCommands";
import { fileCommands } from "./tauriCommands/fileCommands";
import { gitCommands } from "./tauriCommands/gitCommands";
import { jobCommands } from "./tauriCommands/jobCommands";
import {
  searchCommands,
  type SearchEvent,
  type SearchResult,
} from "./tauriCommands/searchCommands";
import { syncCommands } from "./tauriCommands/syncCommands";
import {
  systemCommands,
  type DriveInfo,
  type ShowContextMenuRequest,
} from "./tauriCommands/systemCommands";

export type { DriveInfo, SearchEvent, SearchResult, ShowContextMenuRequest };

const fileSystem = {
  ...systemCommands,
  ...fileCommands,
  ...jobCommands,
  ...archiveCommands,
  ...searchCommands,
  ...syncCommands,
  ...gitCommands,
};

export function useFileSystem() {
  return fileSystem;
}

export function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const message = Reflect.get(error, "message");
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallbackMessage;
}
