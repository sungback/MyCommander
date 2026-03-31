import React, { useEffect, useState } from "react";
import { usePanelStore } from "../../store/panelStore";
import { useFileSystem } from "../../hooks/useFileSystem";
import { PanelState } from "../../types/file";
import { formatSize } from "../../utils/format";
import { Copy, Eye, FilePenLine, FolderPlus, MoveRight, Power, Search, Trash2 } from "lucide-react";
import { isMacPlatform, useAppCommands } from "../../hooks/useAppCommands";

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
  const { getAvailableSpace } = useFileSystem();
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
  const [availableSpace, setAvailableSpace] = useState<{
    left: number | null | undefined;
    right: number | null | undefined;
  }>({
    left: undefined,
    right: undefined,
  });
  const isMac = isMacPlatform();
  const operations: OperationButtonConfig[] = [
    { keyLabel: "F3", title: "보기", icon: <Eye size={15} />, onClick: openPreview },
    { keyLabel: "F4", title: "편집", icon: <FilePenLine size={15} />, onClick: openEditor },
    { keyLabel: "F5", title: "복사", icon: <Copy size={15} />, onClick: openCopy },
    { keyLabel: "F6", title: "이동", icon: <MoveRight size={15} />, onClick: openMove },
    { keyLabel: "F7", title: "새 폴더", icon: <FolderPlus size={15} />, onClick: openMkdir },
    { keyLabel: "F8", title: "삭제", icon: <Trash2 size={15} />, onClick: openDelete },
    {
      keyLabel: isMac ? "Option+F7" : "Alt+F7",
      title: "검색",
      icon: <Search size={15} />,
      onClick: openSearch,
    },
    {
      keyLabel: isMac ? "Cmd+Q" : "Alt+F4",
      title: "종료",
      icon: <Power size={15} />,
      onClick: closeApp,
    },
  ];

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
        <div className="flex flex-wrap items-center gap-2">
          {operations.map((operation) => (
            <OperationButton key={operation.keyLabel} {...operation} />
          ))}
        </div>
      </div>
    </div>
  );
};
