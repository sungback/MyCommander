import {
  clearClipboardOnEscape,
  closeOpenDialog,
  handleFunctionShortcut,
  handleModifiedShortcut,
  handleNavigationShortcut,
  type KeyboardHandlerDependencies,
} from "./keyboardShortcutHandlers";

export type { KeyboardHandlerDependencies } from "./keyboardShortcutHandlers";
export type { DirectorySizeCalculationResult } from "./calculatePanelDirectories";

export const createKeyboardHandler =
  (deps: KeyboardHandlerDependencies) => (event: KeyboardEvent) => {
    const isCloseShortcut =
      (deps.isMac && event.metaKey && event.code === "KeyQ") ||
      (!deps.isMac && event.altKey && event.key === "F4");

    if (isCloseShortcut) {
      event.preventDefault();
      void deps.closeApp();
      return;
    }

    if (closeOpenDialog(event, deps.openDialog)) {
      return;
    }

    if (clearClipboardOnEscape(event)) {
      return;
    }

    handleFunctionShortcut(event, deps);
    if (handleModifiedShortcut(event, deps)) {
      return;
    }

    handleNavigationShortcut(event, deps);
  };
