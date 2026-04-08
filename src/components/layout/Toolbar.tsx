import React from "react";
import { isMacPlatform, useAppCommands } from "../../hooks/useAppCommands";
import { createBottomActionDefinitions } from "./bottomActions";

export const Toolbar: React.FC = () => {
  const isMac = isMacPlatform();
  const appCommands = useAppCommands();
  const operations = createBottomActionDefinitions(isMac);

  return (
    <div className="flex h-12 w-full items-center justify-between px-2 bg-bg-secondary border-b border-border-color shrink-0">
      <div className="flex items-center gap-1">
        {operations.map((op) => (
          <button
            key={op.id}
            onClick={() => void appCommands[op.command]()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-bg-panel hover:bg-bg-hover active:opacity-80 transition-colors border border-border-color text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-color"
          >
            <span className="text-text-secondary font-mono text-xs">{op.keyLabel}</span>
            <span>{op.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
