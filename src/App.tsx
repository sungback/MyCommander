
import { useEffect } from "react";
import { StatusBar } from "./components/layout/StatusBar";
import { DualPanel } from "./components/panel/DualPanel";
import { usePanelStore } from "./store/panelStore";
import { useKeyboard } from "./hooks/useKeyboard";
import { DialogContainer } from "./components/dialogs/DialogContainer";
import { SearchPreviewDialogs } from "./components/dialogs/SearchPreviewDialogs";
import { ContextMenu } from "./components/layout/ContextMenu";

function App() {
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const activePanelId = usePanelStore((s) => s.activePanel);
  
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
