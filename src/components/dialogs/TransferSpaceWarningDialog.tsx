import * as Dialog from "@radix-ui/react-dialog";
import { useTransferSpaceWarningStore } from "../../store/transferSpaceWarningStore";
import { formatSize } from "../../utils/format";

// 상태바의 "… available"과 같은 숫자로 보이도록 10진 단위로 표시한다.
const formatSpace = (bytes: number) => formatSize(bytes, { base: 1000 });

export const TransferSpaceWarningDialog = () => {
  const pending = useTransferSpaceWarningStore((state) => state.pending);
  const respond = useTransferSpaceWarningStore((state) => state.respond);
  const shortage = pending?.shortage;

  return (
    <Dialog.Root open={Boolean(shortage)} onOpenChange={(open) => !open && respond(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[450px] z-50 p-4 text-text-primary">
          <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
            Not Enough Space
          </Dialog.Title>
          {shortage && (
            <div className="mb-6 space-y-3">
              <Dialog.Description className="text-sm">
                The destination may not have enough free space to{" "}
                {shortage.isMove ? "move" : "copy"} these items. The operation may fail
                partway through.
              </Dialog.Description>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs px-2 py-1.5 bg-bg-secondary rounded">
                <dt className="text-text-secondary">Required</dt>
                <dd className="font-mono">
                  {shortage.complete ? "" : "at least "}
                  {formatSpace(shortage.requiredBytes)}
                </dd>
                <dt className="text-text-secondary">Available</dt>
                <dd className="font-mono">{formatSpace(shortage.availableBytes)}</dd>
              </dl>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => respond(false)}
              className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => respond(true)}
              className="px-4 py-1.5 min-w-[100px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity"
            >
              Continue Anyway
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
