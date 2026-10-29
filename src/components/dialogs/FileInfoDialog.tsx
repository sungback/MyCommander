import * as Dialog from "@radix-ui/react-dialog";
import type { DirectorySizeStatus, FileEntry } from "../../types/file";
import { formatDate, formatSize } from "../../utils/format";

interface FileInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  infoEntry: FileEntry | null;
  infoSize: number | null;
  infoSizeStatus?: DirectorySizeStatus;
  infoLoading: boolean;
  infoError: string | null;
}

// 패널 목록과 같은 기호로 폴더 크기의 정확도를 표시한다.
const formatDirectorySize = (size: number | null, status?: DirectorySizeStatus) => {
  const text = formatSize(size);
  if (!text) {
    return text;
  }

  switch (status) {
    case "limited":
      return `≥${text}`;
    case "partial":
      return `${text}+`;
    case "estimated":
      return `~${text}`;
    default:
      return text;
  }
};

export const FileInfoDialog = ({
  isOpen,
  onClose,
  infoEntry,
  infoSize,
  infoSizeStatus,
  infoLoading,
  infoError,
}: FileInfoDialogProps) => (
  <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
      <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[520px] z-50 p-4 focus:outline-none text-text-primary">
        <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
          File Information
        </Dialog.Title>

        {infoEntry ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-text-secondary mb-1">Name</p>
              <p className="break-all">{infoEntry.name}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-1">Path</p>
              <p className="break-all font-mono text-xs text-text-secondary">
                {infoEntry.path}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-text-secondary mb-1">Type</p>
                <p className="capitalize">{infoEntry.kind}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Hidden</p>
                <p>{infoEntry.isHidden ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Size</p>
                <p>
                  {infoLoading
                    ? "Calculating..."
                    : infoError
                      ? infoError
                      : (infoEntry.kind === "directory"
                          ? formatDirectorySize(infoSize, infoSizeStatus)
                          : formatSize(infoEntry.size)) || "Unknown"}
                </p>
                {!infoLoading && !infoError && infoSizeStatus === "limited" ? (
                  <p className="text-xs text-text-secondary mt-1">
                    Excludes items without read permission.
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Modified</p>
                <p>{formatDate(infoEntry.lastModified) || "Unknown"}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No item selected.</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors"
          >
            Close
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
