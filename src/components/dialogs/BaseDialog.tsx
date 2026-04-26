import React from "react";
import * as Dialog from "@radix-ui/react-dialog";

type DialogContentProps = React.ComponentPropsWithoutRef<typeof Dialog.Content>;

interface BaseDialogProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
  submitLabel?: string;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  submitAutoFocus?: boolean;
  onOpenAutoFocus?: DialogContentProps["onOpenAutoFocus"];
}

export const BaseDialog: React.FC<BaseDialogProps> = ({
  title,
  isOpen,
  onClose,
  onSubmit,
  children,
  submitLabel = "OK",
  errorMessage = null,
  isSubmitting = false,
  submitAutoFocus = true,
  onOpenAutoFocus,
}) => (
  <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
      <Dialog.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[450px] z-50 p-4 focus:outline-none text-text-primary"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Dialog.Description className="sr-only">
            {title} dialog
          </Dialog.Description>
          <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
            {title}
          </Dialog.Title>
          <div className="mb-6 space-y-3">
            {children}
            {errorMessage ? (
              <p className="text-xs text-red-400">{errorMessage}</p>
            ) : null}
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
              type="submit"
              autoFocus={submitAutoFocus}
              disabled={isSubmitting}
              className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
