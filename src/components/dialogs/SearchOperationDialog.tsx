import * as Dialog from "@radix-ui/react-dialog";

export type SearchOperation = "copy" | "move";

interface SearchOperationDialogProps {
  operation: SearchOperation | null;
  selectedCount: number;
  target: string;
  error: string | null;
  isApplying: boolean;
  onClose: () => void;
  onTargetChange: (target: string) => void;
  onSubmit: () => void;
}

export const SearchOperationDialog = ({
  operation,
  selectedCount,
  target,
  error,
  isApplying,
  onClose,
  onTargetChange,
  onSubmit,
}: SearchOperationDialogProps) => (
  <Dialog.Root open={operation !== null} onOpenChange={(open) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
      <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[460px] z-50 p-4 focus:outline-none text-text-primary">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
            {operation === "copy" ? "Copy" : "Move"} {selectedCount} search result(s)
          </Dialog.Title>
          <div className="mb-4 space-y-3">
            <p className="text-xs text-text-secondary">Target path:</p>
            <input
              autoFocus
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={target}
              onChange={(event) => onTargetChange(event.target.value)}
              className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white"
            />
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isApplying}
              className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying
                ? operation === "copy"
                  ? "Copying..."
                  : "Moving..."
                : operation === "copy"
                  ? "Copy"
                  : "Move"}
            </button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
