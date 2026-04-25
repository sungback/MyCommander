import * as Dialog from "@radix-ui/react-dialog";

interface CopyConflictDialogProps {
  isOpen: boolean;
  conflictFiles: string[];
  isSubmitting: boolean;
  onClose: () => void;
  onSkipExisting: () => void;
  onOverwriteAll: () => void;
}

export const CopyConflictDialog = ({
  isOpen,
  conflictFiles,
  isSubmitting,
  onClose,
  onSkipExisting,
  onOverwriteAll,
}: CopyConflictDialogProps) => (
  <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
      <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[450px] z-50 p-4 text-text-primary">
        <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
          Files Already Exist
        </Dialog.Title>
        <div className="mb-6 space-y-3">
          <p className="text-sm">
            The following {conflictFiles.length} item(s) already exist in the destination:
          </p>
          <ul className="max-h-40 overflow-y-auto space-y-1">
            {conflictFiles.map((name) => (
              <li
                key={name}
                className="text-xs font-mono text-text-secondary truncate px-2 py-0.5 bg-bg-secondary rounded"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSkipExisting}
            disabled={isSubmitting}
            className="px-4 py-1.5 min-w-[100px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Skipping..." : "Skip Existing"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onOverwriteAll}
            disabled={isSubmitting}
            className="px-4 py-1.5 min-w-[100px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Overwriting..." : "Overwrite All"}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
