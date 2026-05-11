import React from "react";
import { usePanelStore } from "../../store/panelStore";
import { HardDrive } from "lucide-react";
import { clsx } from "clsx";
import { useFileSystem, type DriveInfo } from "../../hooks/useFileSystem";
import { formatSize } from "../../utils/format";
import { MAC_ROOT_DISPLAY_NAME } from "../../utils/pathDisplay";

interface DriveListProps {
  panelId: "left" | "right";
}

const getDriveSpaceText = (drive: DriveInfo) => {
  if (drive.availableSpace === undefined || drive.availableSpace === null) {
    return null;
  }

  return `${formatSize(drive.availableSpace, { base: 1000 })} free`;
};

const isWindowsDriveRoot = (mountPoint: string) => /^[A-Z]:[\\/]?$/i.test(mountPoint);

const getDriveLabel = (drive: DriveInfo) => {
  if (drive.mount_point === "/") {
    return drive.name || MAC_ROOT_DISPLAY_NAME;
  }

  return drive.mount_point.length < 4 ? `[${drive.mount_point}]` : drive.name;
};

const isSameOrNestedMount = (currentPath: string, mountPoint: string) => {
  if (mountPoint === "/") {
    return currentPath === "/";
  }

  if (isWindowsDriveRoot(mountPoint)) {
    return currentPath
      .toUpperCase()
      .startsWith(mountPoint.slice(0, 2).toUpperCase());
  }

  const normalizedCurrent = currentPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedMount = mountPoint.replace(/\\/g, "/").replace(/\/+$/, "");

  return (
    normalizedCurrent === normalizedMount ||
    normalizedCurrent.startsWith(`${normalizedMount}/`)
  );
};

export const DriveList: React.FC<DriveListProps> = ({ panelId }) => {
  const currentPath = usePanelStore((s) =>
    panelId === "left" ? s.leftPanel.currentPath : s.rightPanel.currentPath
  );
  const setPath = usePanelStore((s) => s.setPath);
  const fs = useFileSystem();

  const [drives, setDrives] = React.useState<DriveInfo[]>([]);

  React.useEffect(() => {
    fs.getDrives().then(setDrives).catch(console.error);
  }, [fs]);

  return (
    <div className="flex bg-bg-secondary border-b border-border-color h-8 items-center px-2 gap-1 shrink-0 overflow-x-auto text-xs font-mono">
      {drives.map((drive) => {
        const spaceText = getDriveSpaceText(drive);
        return (
          <button
            key={drive.mount_point}
            onClick={() => setPath(panelId, drive.mount_point)}
            className={clsx(
              "flex items-center gap-1.5 px-2 py-1 rounded hover:bg-bg-hover transition-colors focus:outline-none focus:ring-1 focus:ring-accent-color",
              isSameOrNestedMount(currentPath, drive.mount_point)
                ? "text-text-primary bg-bg-hover"
                : "text-text-secondary"
            )}
            title={`${drive.name} (${drive.type})${spaceText ? ` - ${spaceText}` : ""}`}
          >
            <HardDrive size={14} />
            <span className="font-bold whitespace-nowrap">
              {getDriveLabel(drive)}
            </span>
            {spaceText ? (
              <span className="whitespace-nowrap text-[10px] font-normal text-text-secondary/80">
                {spaceText}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
