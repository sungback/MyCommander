import { BaseDialog } from "./BaseDialog";

interface DeleteConfirmationDialogProps {
  errorMessage: string | null;
  isOpen: boolean;
  isSubmitting: boolean;
  itemLabel: string;
  onClose: () => void;
  onSubmit: () => void;
}

export const DeleteConfirmationDialog = ({
  errorMessage,
  isOpen,
  isSubmitting,
  itemLabel,
  onClose,
  onSubmit,
}: DeleteConfirmationDialogProps) => (
  <BaseDialog
    isOpen={isOpen}
    onClose={onClose}
    onSubmit={onSubmit}
    title="Confirm Deletion"
    submitLabel={isSubmitting ? "Deleting..." : "Delete"}
    isSubmitting={isSubmitting}
    errorMessage={errorMessage}
  >
    <p className="text-sm">
      Do you really want to delete{" "}
      <span className="font-semibold text-accent-color break-all">
        {itemLabel}
      </span>
      ?
    </p>
  </BaseDialog>
);
