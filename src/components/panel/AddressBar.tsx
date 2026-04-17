import React from "react";
import { usePanelStore } from "../../store/panelStore";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ChevronRight,
  ClipboardCopy,
  Home,
  RefreshCw,
} from "lucide-react";
import { clsx } from "clsx";
import { arePathsEquivalent, getBreadcrumbParts } from "../../utils/path";
import { useFileSystem } from "../../hooks/useFileSystem";
import { isMacPlatform, useAppCommands } from "../../hooks/useAppCommands";

interface AddressBarProps {
  panelId: "left" | "right";
}

export const AddressBar: React.FC<AddressBarProps> = ({ panelId }) => {
  const currentPath = usePanelStore((s) =>
    panelId === "left" ? s.leftPanel.currentPath : s.rightPanel.currentPath
  );
  const otherPanelPath = usePanelStore((s) =>
    panelId === "left" ? s.rightPanel.currentPath : s.leftPanel.currentPath
  );
  const setPath = usePanelStore((s) => s.setPath);
  const goBack = usePanelStore((s) => s.goBack);
  const goForward = usePanelStore((s) => s.goForward);
  const historyIndex = usePanelStore((s) =>
    panelId === "left" ? s.leftPanel.historyIndex : s.rightPanel.historyIndex
  );
  const historyLength = usePanelStore((s) =>
    panelId === "left" ? s.leftPanel.history.length : s.rightPanel.history.length
  );
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyLength - 1;
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const activePanel = usePanelStore((s) => s.activePanel);
  const isActive = activePanel === panelId;
  const { getHomeDir } = useFileSystem();
  const { syncOtherPanelToCurrentPath, copyCurrentPath } = useAppCommands();
  const isMac = isMacPlatform();
  const otherPanelLabel = panelId === "left" ? "right" : "left";
  const isAlreadySynced = arePathsEquivalent(currentPath, otherPanelPath);

  const parts = getBreadcrumbParts(currentPath);

  const handleNavigate = (path: string) => {
    setActivePanel(panelId);
    setPath(panelId, path);
  };

  const handleGoHome = async () => {
    const homeDir = await getHomeDir();
    handleNavigate(homeDir);
  };

  return (
    <div className={clsx(
      "flex h-8 items-center px-2 border-b text-sm transition-colors",
      isActive ? "bg-bg-panel border-accent-color/50" : "bg-bg-secondary border-border-color"
    )}>
      <button
        type="button"
        onClick={() => { setActivePanel(panelId); goBack(panelId); }}
        disabled={!canGoBack}
        className={clsx(
          "flex items-center px-1 rounded transition-colors",
          canGoBack
            ? "text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer"
            : "text-text-secondary opacity-30 cursor-default"
        )}
        title="뒤로 (Alt+←)"
      >
        <ArrowLeft size={14} />
      </button>
      <button
        type="button"
        onClick={() => { setActivePanel(panelId); goForward(panelId); }}
        disabled={!canGoForward}
        className={clsx(
          "flex items-center px-1 rounded transition-colors mr-1",
          canGoForward
            ? "text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer"
            : "text-text-secondary opacity-30 cursor-default"
        )}
        title="앞으로 (Alt+→)"
      >
        <ArrowRight size={14} />
      </button>
      <button
        type="button"
        onClick={() => void handleGoHome()}
        className="flex items-center text-text-secondary gap-1 mr-2 px-1 hover:text-text-primary cursor-pointer hover:bg-bg-hover rounded transition-colors"
        title="Go to home directory"
      >
        <Home size={14} />
      </button>
      
      <div className="flex items-center flex-1 overflow-hidden">
        {parts.map((part, index) => (
          <React.Fragment key={part.path}>
            {index > 0 && <ChevronRight size={14} className="text-text-secondary mx-0.5 shrink-0" />}
            <button
              type="button"
              onClick={() => handleNavigate(part.path)}
              className="hover:bg-bg-hover hover:text-text-primary px-1 rounded cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis transition-colors text-text-secondary"
              title={part.path}
            >
              {part.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      <button
        type="button"
        onClick={() => refreshPanel(panelId)}
        className="flex items-center text-text-secondary gap-1 ml-2 px-1 hover:text-text-primary cursor-pointer hover:bg-bg-hover rounded transition-colors"
        title="Refresh"
      >
        <RefreshCw size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          setActivePanel(panelId);
          void copyCurrentPath(panelId);
        }}
        className="flex items-center text-text-secondary gap-1 ml-1 px-1 rounded transition-colors cursor-pointer hover:bg-bg-hover hover:text-text-primary"
        title={`Copy current path (${isMac ? "Cmd" : "Ctrl"}+Shift+C)`}
      >
        <ClipboardCopy size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          setActivePanel(panelId);
          syncOtherPanelToCurrentPath(panelId);
        }}
        disabled={isAlreadySynced}
        className={clsx(
          "flex items-center text-text-secondary gap-1 ml-1 px-1 rounded transition-colors",
          isAlreadySynced
            ? "cursor-default opacity-40"
            : "cursor-pointer hover:bg-bg-hover hover:text-text-primary"
        )}
        title={
          isAlreadySynced
            ? `The ${otherPanelLabel} panel is already on this folder`
            : `Open this folder in the ${otherPanelLabel} panel (${isMac ? "Cmd" : "Ctrl"}+Shift+M)`
        }
      >
        <ArrowRightLeft size={14} />
      </button>
    </div>
  );
};
