import React from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { FilePanel } from "./FilePanel";

export const DualPanel: React.FC = () => {
  return (
    <PanelGroup orientation="horizontal" className="flex-1 w-full h-full flex min-h-0 overflow-hidden">
      <Panel defaultSize={50} minSize={20} className="flex flex-col h-full min-h-0 overflow-hidden">
        <FilePanel id="left" />
      </Panel>

      <PanelResizeHandle className="w-1 bg-border-color hover:bg-accent-color/50 active:bg-accent-color transition-colors flex-none cursor-col-resize shadow-md relative z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-black/20 rounded" />
      </PanelResizeHandle>

      <Panel defaultSize={50} minSize={20} className="flex flex-col h-full min-h-0 overflow-hidden">
        <FilePanel id="right" />
      </Panel>
    </PanelGroup>
  );
};
