import React, { useRef, useEffect } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";
import { FilePanel } from "./FilePanel";
import { useSettingsStore } from "../../store/settingsStore";

export const DualPanel: React.FC = () => {
  const panelLeftRatio = useSettingsStore(s => s.panelLeftRatio);
  const setPanelLeftRatio = useSettingsStore(s => s.setPanelLeftRatio);
  
  const leftPanelRef = useRef<ImperativePanelHandle>(null);

  useEffect(() => {
    if (leftPanelRef.current) {
      const currentSize = leftPanelRef.current.getSize();
      if (Math.abs(currentSize - panelLeftRatio) > 0.5) {
        leftPanelRef.current.resize(panelLeftRatio);
      }
    }
  }, [panelLeftRatio]);

  return (
    <PanelGroup 
      orientation="horizontal" 
      className="flex-1 w-full h-full flex min-h-0 overflow-hidden"
      autoSaveId="dual-panel-sizes"
      onLayout={(sizes) => {
        if (sizes.length === 2 && Math.abs(sizes[0] - panelLeftRatio) > 0.5) {
          setPanelLeftRatio(sizes[0]);
        }
      }}
    >
      <Panel ref={leftPanelRef} defaultSize={panelLeftRatio} minSize={20} className="flex flex-col h-full min-h-0 overflow-hidden">
        <FilePanel id="left" />
      </Panel>

      <PanelResizeHandle className="w-1 bg-border-color hover:bg-accent-color/50 active:bg-accent-color transition-colors flex-none cursor-col-resize shadow-md relative z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-black/20 rounded" />
      </PanelResizeHandle>

      <Panel defaultSize={100 - panelLeftRatio} minSize={20} className="flex flex-col h-full min-h-0 overflow-hidden">
        <FilePanel id="right" />
      </Panel>
    </PanelGroup>
  );
};
