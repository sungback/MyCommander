import React from "react";
import { Plus, X } from "lucide-react";
import { usePanelStore } from "../../store/panelStore";
import { clsx } from "clsx";
import { PanelTabState } from "../../types/file";

interface TabBarProps {
  panelId: "left" | "right";
}

const getTabLabel = (tab: PanelTabState) => {
  if (tab.currentPath === "/" || /^[A-Z]:\\$/.test(tab.currentPath)) {
    return tab.currentPath;
  }

  const parts = tab.currentPath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? tab.currentPath;
};

export const TabBar: React.FC<TabBarProps> = ({ panelId }) => {
  const panel = usePanelStore((s) =>
    panelId === "left" ? s.leftPanel : s.rightPanel
  );
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const addTab = usePanelStore((s) => s.addTab);
  const activateTab = usePanelStore((s) => s.activateTab);
  const closeTab = usePanelStore((s) => s.closeTab);
  const tabs = panel.tabs;
  const canCloseTabs = tabs.length > 1;

  return (
    <div className="flex bg-bg-secondary border-b border-border-color h-8 items-end px-1 gap-1 shrink-0 overflow-x-auto overflow-y-hidden custom-scrollbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => {
            setActivePanel(panelId);
            activateTab(panelId, tab.id);
          }}
          className={clsx(
            "flex items-center gap-2 px-3 py-1 rounded-t text-sm min-w-24 max-w-48 cursor-pointer select-none group",
            tab.id === panel.activeTabId
              ? "bg-bg-panel text-text-primary border-t-2 border-accent-color relative z-10 before:absolute before:-bottom-px before:left-0 before:right-0 before:h-px before:bg-bg-panel" 
              : "bg-bg-secondary hover:bg-bg-hover text-text-secondary border-t-2 border-transparent"
          )}
        >
          <span className="truncate">{getTabLabel(tab)}</span>
          {canCloseTabs ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                closeTab(panelId, tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-border-color rounded transition-opacity"
              title="Close tab"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setActivePanel(panelId);
          addTab(panelId);
        }}
        className="p-1 mb-1 ml-1 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded cursor-pointer transition-colors"
        title="New tab"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};
