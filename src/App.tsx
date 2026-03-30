import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { StatusBar } from "./components/layout/StatusBar";
import { DualPanel } from "./components/panel/DualPanel";
import { usePanelStore } from "./store/panelStore";
import { useKeyboard } from "./hooks/useKeyboard";
import { DialogContainer } from "./components/dialogs/DialogContainer";
import { SearchPreviewDialogs } from "./components/dialogs/SearchPreviewDialogs";
import { ContextMenu } from "./components/layout/ContextMenu";
import { isMacPlatform } from "./hooks/useAppCommands";

function App() {
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const activePanelId = usePanelStore((s) => s.activePanel);
  const showHiddenFiles = usePanelStore((s) => s.showHiddenFiles);
  const setShowHiddenFiles = usePanelStore((s) => s.setShowHiddenFiles);
  
  // Initialize global shortcuts
  useKeyboard();

  // Global Keyboard listener for Tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setActivePanel(activePanelId === "left" ? "right" : "left");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanelId, setActivePanel]);

  useEffect(() => {
    if (!isMacPlatform()) {
      return;
    }

    let isMounted = true;

    const attachListener = async () => {
      const unlisten = await listen<boolean>("show-hidden-files-changed", (event) => {
        if (!isMounted) {
          return;
        }

        setShowHiddenFiles(Boolean(event.payload));
      });

      if (!isMounted) {
        unlisten();
      }

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    void attachListener().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [setShowHiddenFiles]);

  useEffect(() => {
    if (!isMacPlatform()) {
      return;
    }

    void invoke("set_show_hidden_menu_checked", { checked: showHiddenFiles });
  }, [showHiddenFiles]);

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary font-sans overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <DualPanel />
      </div>
      <StatusBar />
      <DialogContainer />
      <SearchPreviewDialogs />
      <ContextMenu />
    </div>
  );
}

export default App;
