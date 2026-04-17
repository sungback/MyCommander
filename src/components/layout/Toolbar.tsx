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
      <div className="flex items-center">
        <button
          onClick={() => {
            const { useDialogStore } = require("../../store/dialogStore");
            useDialogStore.getState().setOpenDialog("settings");
          }}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded bg-transparent hover:bg-bg-hover active:opacity-80 transition-colors text-text-secondary hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-color"
          title="Preferences"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>
  );
};
