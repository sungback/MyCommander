import React from "react";
import { usePanelStore } from "../../store/panelStore";
import { HardDrive } from "lucide-react";
import { clsx } from "clsx";
import { useFileSystem, DriveInfo } from "../../hooks/useFileSystem";

interface DriveListProps {
  panelId: "left" | "right";
}

export const DriveList: React.FC<DriveListProps> = ({ panelId }) => {
  const currentPath = usePanelStore((s) =>
    panelId === "left" ? s.leftPanel.currentPath : s.rightPanel.currentPath
  );
  const setPath = usePanelStore((s) => s.setPath);
  const activeDrive = currentPath.split(/[\/\\]/)[0].toUpperCase();
  const fs = useFileSystem();

  const [drives, setDrives] = React.useState<DriveInfo[]>([]);

  React.useEffect(() => {
    fs.getDrives().then(setDrives).catch(console.error);
  }, [fs]);

  return (
    <div className="flex bg-bg-secondary border-b border-border-color h-8 items-center px-2 gap-1 shrink-0 overflow-x-auto text-xs font-mono">
      {drives.map((drive) => {
        const letter = drive.mount_point.replace(/\\$/, "").toUpperCase();
        return (
          <button
            key={drive.mount_point}
            onClick={() => setPath(panelId, drive.mount_point)}
            className={clsx(
              "flex items-center gap-1.5 px-2 py-1 rounded hover:bg-bg-hover transition-colors focus:outline-none focus:ring-1 focus:ring-accent-color",
              (activeDrive === letter || currentPath.startsWith(drive.mount_point))
                ? "text-text-primary bg-bg-hover" 
                : "text-text-secondary"
            )}
            title={`${drive.name} (${drive.drive_type})`}
          >
            <HardDrive size={14} />
            <span className="font-bold">
              {drive.mount_point.length < 4 ? `[${drive.mount_point}]` : drive.name}
            </span>
          </button>
        );
      })}
      <div className="ml-auto flex gap-2 text-text-secondary/70">
        {/* Drive space could be fetched later */}
      </div>
    </div>
  );
};
