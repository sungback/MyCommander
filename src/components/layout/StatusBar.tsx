import React, { useEffect, useState } from "react";
import { usePanelStore } from "../../store/panelStore";
import { useUiStore } from "../../store/uiStore";
import { useFileSystem } from "../../hooks/useFileSystem";
import { PanelState } from "../../types/file";
import { formatSize } from "../../utils/format";
import { isMacPlatform, useAppCommands } from "../../hooks/useAppCommands";
import { BottomActionDefinition, createBottomActionDefinitions } from "./bottomActions";
import { Clipboard, Scissors } from "lucide-react";

type PanelId = "left" | "right";

interface PanelStatusProps {
  panelId: PanelId;
  panel: PanelState;
  isActive: boolean;
  availableSpace: number | null | undefined;
}

const getPanelSummary = (panel: PanelState) => {
  const visibleEntries = panel.files.filter((entry) => entry.name !== "..");
  const selectedEntries = visibleEntries.filter((entry) =>
    panel.selectedItems.has(entry.path)
  );
  const hasUnknownSelectedSize = selectedEntries.some(
    (entry) => entry.size === undefined || entry.size === null
  );
  const selectedSize = selectedEntries.reduce(
    (total, entry) => total + (entry.size ?? 0),
    0
  );

  if (selectedEntries.length > 0) {
    const sizeText = hasUnknownSelectedSize
      ? "Calculating..."
      : formatSize(selectedSize);

    return `${selectedEntries.length} of ${visibleEntries.length} selected (${sizeText})`;
  }

  return `${visibleEntries.length} items`;
};

const getAvailableSpaceText = (availableSpace: number | null | undefined) => {
  if (availableSpace === undefined) {
    return "Loading...";
  }

  if (availableSpace === null) {
    return "Unknown available";
  }

  return `${formatSize(availableSpace, { base: 1000 })} available`;
};

const shouldSkipAvailableSpaceRequest = (panel: PanelState) =>
  panel.files.length === 0 && /^[A-Z]:\\$/.test(panel.currentPath);

const PanelStatus: React.FC<PanelStatusProps> = ({
  panelId,
  panel,
  isActive,
  availableSpace,
}) => (
  <div
    className={`flex-1 min-w-0 px-4 ${
      isActive ? "text-text-primary" : "text-text-secondary"
    }`}
  >
    <span className="mr-2 uppercase">{panelId}</span>
    <span>
      {getPanelSummary(panel)}, {getAvailableSpaceText(availableSpace)}
    </span>
  </div>
);

interface OperationButtonConfig {
  keyLabel: string;
  title: string;
  icon: React.ReactNode;
  onClick: () => void | Promise<void>;
}

const OperationButton: React.FC<OperationButtonConfig> = ({
  keyLabel,
  title,
  icon,
  onClick,
}) => (
  <button
    type="button"
    onClick={() => void onClick()}
    className="flex min-w-[118px] items-center gap-2 rounded-md border border-border-color bg-bg-panel px-3 py-2 text-left text-text-primary transition-colors hover:bg-bg-hover"
  >
    <span className="shrink-0 text-accent-color">{icon}</span>
    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <span className="truncate text-sm">{title}</span>
      <span className="shrink-0 font-mono text-[11px] text-text-secondary">{keyLabel}</span>
    </span>
  </button>
);

export const StatusBar: React.FC = () => {
  const activePanelId = usePanelStore((s) => s.activePanel);
  const leftPanel = usePanelStore((s) => s.leftPanel);
  const rightPanel = usePanelStore((s) => s.rightPanel);
  const statusMessage = useUiStore((s) => s.statusMessage);
  const clipboard = usePanelStore((s) => s.clipboard);
  const clearClipboard = usePanelStore((s) => s.clearClipboard);
  const { getAvailableSpace } = useFileSystem();
  const appCommands = useAppCommands();
  const [commandValue, setCommandValue] = useState("");
  const [availableSpace, setAvailableSpace] = useState<{
    left: number | null | undefined;
    right: number | null | undefined;
  }>({
    left: undefined,
    right: undefined,
  });
  const isMac = isMacPlatform();
  const activePanel = activePanelId === "left" ? leftPanel : rightPanel;
  const operations: OperationButtonConfig[] = createBottomActionDefinitions(isMac).map(
    (action: BottomActionDefinition) => ({
      keyLabel: action.keyLabel,
      title: action.title,
      icon: <action.icon size={15} />,
      onClick: appCommands[action.command],
    })
  );

  useEffect(() => {
    let cancelled = false;

    if (shouldSkipAvailableSpaceRequest(leftPanel)) {
      return () => {
        cancelled = true;
      };
    }

    setAvailableSpace((current) => ({ ...current, left: undefined }));

    void getAvailableSpace(leftPanel.currentPath).then((space) => {
      if (!cancelled) {
        setAvailableSpace((current) => ({ ...current, left: space }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [getAvailableSpace, leftPanel.currentPath, leftPanel.files.length]);

  useEffect(() => {
    let cancelled = false;

    if (shouldSkipAvailableSpaceRequest(rightPanel)) {
      return () => {
        cancelled = true;
      };
    }

    setAvailableSpace((current) => ({ ...current, right: undefined }));

    void getAvailableSpace(rightPanel.currentPath).then((space) => {
      if (!cancelled) {
        setAvailableSpace((current) => ({ ...current, right: space }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [getAvailableSpace, rightPanel.currentPath, rightPanel.files.length]);

  return (
    <div className="w-full shrink-0 border-t border-border-color bg-bg-secondary">
      <div className="flex h-8 items-center text-xs font-mono">
        <PanelStatus
          panelId="left"
          panel={leftPanel}
          isActive={activePanelId === "left"}
          availableSpace={availableSpace.left}
        />
        <div className="h-full w-px bg-border-color" />
        <PanelStatus
          panelId="right"
          panel={rightPanel}
          isActive={activePanelId === "right"}
          availableSpace={availableSpace.right}
        />
      </div>
      <div className="border-t border-border-color/80 px-2 py-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const nextCommand = commandValue.trim();
            if (!nextCommand) {
              return;
            }

            void appCommands.runCommandInCurrentPath(nextCommand, activePanelId);
            setCommandValue("");
          }}
        >
          <label
            htmlFor="command-line-input"
            className="shrink-0 font-mono text-xs uppercase text-text-secondary"
          >
            Cmd
          </label>
          <div className="min-w-0 shrink-0 rounded-md border border-border-color bg-bg-panel px-2 py-1 font-mono text-[11px] text-text-secondary">
            {activePanel.currentPath}
          </div>
          <input
            id="command-line-input"
            type="text"
            value={commandValue}
            onChange={(event) => setCommandValue(event.target.value)}
            placeholder={
              isMac
                ? "Run command in Terminal for the current folder"
                : "Run command in Command Prompt for the current folder"
            }
            className="min-w-0 flex-1 rounded-md border border-border-color bg-bg-panel px-3 py-2 font-mono text-sm text-text-primary outline-none transition-colors focus:border-accent-color"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </div>
      <div className="border-t border-border-color/80 px-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {operations.map((operation) => (
            <OperationButton key={operation.keyLabel} {...operation} />
          ))}
          {clipboard && (
            <div className="ml-auto flex items-center gap-1.5 rounded-md border border-border-color bg-bg-panel px-3 py-1.5 text-xs text-text-secondary">
              {clipboard.operation === "copy"
                ? <Clipboard size={12} />
                : <Scissors size={12} />
              }
              <span>
                {clipboard.paths.length}개 항목{" "}
                {clipboard.operation === "copy" ? "복사됨" : "잘라내기됨"}
              </span>
              <button
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                title="클립보드 초기화 (Escape)"
                onClick={clearClipboard}
              >
                ×
              </button>
            </div>
          )}
          {statusMessage && !clipboard ? (
            <div className="ml-auto rounded-md border border-border-color bg-bg-panel px-3 py-2 text-sm text-text-secondary">
              {statusMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
