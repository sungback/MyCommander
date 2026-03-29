import React from "react";
import { Plus, X } from "lucide-react";
import { usePanelStore } from "../../store/panelStore";
import { clsx } from "clsx";

interface TabBarProps {
  panelId: "left" | "right";
}

export const TabBar: React.FC<TabBarProps> = ({ panelId }) => {
  const currentPath = usePanelStore((s) =>
    panelId === "left" ? s.leftPanel.currentPath : s.rightPanel.currentPath
  );
  
  // Later we can move tabs state to panelStore, for now simulate single tab
  const tabs = [{ id: "tab1", name: currentPath.split(/[\/\\]/).pop() || currentPath, active: true }];

  return (
    <div className="flex bg-bg-secondary border-b border-border-color h-8 items-end px-1 gap-1 shrink-0 overflow-x-auto overflow-y-hidden custom-scrollbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={clsx(
            "flex items-center gap-2 px-3 py-1 rounded-t text-sm min-w-24 max-w-48 cursor-pointer select-none group",
            tab.active 
              ? "bg-bg-panel text-text-primary border-t-2 border-accent-color relative z-10 before:absolute before:-bottom-px before:left-0 before:right-0 before:h-px before:bg-bg-panel" 
              : "bg-bg-secondary hover:bg-bg-hover text-text-secondary border-t-2 border-transparent"
          )}
        >
          <span className="truncate">{tab.name}</span>
          <div className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-border-color rounded transition-opacity">
            <X size={12} />
          </div>
        </div>
      ))}
      <div className="p-1 mb-1 ml-1 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded cursor-pointer transition-colors">
        <Plus size={14} />
      </div>
    </div>
  );
};
