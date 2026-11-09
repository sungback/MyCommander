import { BaseDialog } from "./BaseDialog";

interface DeleteConfirmationDialogProps {
  errorMessage: string | null;
  isOpen: boolean;
  isSubmitting: boolean;
  itemLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  permanent?: boolean;
}

export const DeleteConfirmationDialog = ({
  errorMessage,
  isOpen,
  isSubmitting,
  itemLabel,
  onClose,
  onSubmit,
  permanent = false,
}: DeleteConfirmationDialogProps) => (
  <BaseDialog
    isOpen={isOpen}
    onClose={onClose}
    onSubmit={onSubmit}
    title={permanent ? "Confirm Permanent Deletion" : "Confirm Deletion"}
    submitLabel={
      isSubmitting
        ? "Deleting..."
        : permanent
          ? "Delete Permanently"
          : "Delete"
    }
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
    {permanent && (
      <p className="text-xs text-red-500 mt-2">
        휴지통을 거치지 않고 바로 삭제되며 되돌릴 수 없습니다.
      </p>
    )}
  </BaseDialog>
);
