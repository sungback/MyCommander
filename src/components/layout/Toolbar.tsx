import React from "react";
import { isMacPlatform, useAppCommands } from "../../hooks/useAppCommands";

interface ToolbarOperation {
  key: string;
  label: string;
  onClick: () => void | Promise<void>;
}

export const Toolbar: React.FC = () => {
  const isMac = isMacPlatform();
  const {
    openPreview,
    openEditor,
    openCopy,
    openMove,
    openMkdir,
    openDelete,
    openSearch,
    closeApp,
  } = useAppCommands();
  const operations: ToolbarOperation[] = [
    { key: "F3", label: "보기", onClick: openPreview },
    { key: "F4", label: "편집", onClick: openEditor },
    { key: "F5", label: "복사", onClick: openCopy },
    { key: "F6", label: "이동", onClick: openMove },
    { key: "F7", label: "새 폴더", onClick: openMkdir },
    { key: "F8", label: "삭제", onClick: openDelete },
    { key: isMac ? "Option+F7" : "Alt+F7", label: "검색", onClick: openSearch },
    { key: isMac ? "Cmd+Q" : "Alt+F4", label: "종료", onClick: closeApp },
  ];

  return (
    <div className="flex h-12 w-full items-center justify-between px-2 bg-bg-secondary border-b border-border-color shrink-0">
      <div className="flex items-center gap-1">
        {operations.map((op) => (
          <button
            key={op.key}
            onClick={() => void op.onClick()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-bg-panel hover:bg-bg-hover active:opacity-80 transition-colors border border-border-color text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-color"
          >
            <span className="text-text-secondary font-mono text-xs">{op.key}</span>
            <span>{op.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
