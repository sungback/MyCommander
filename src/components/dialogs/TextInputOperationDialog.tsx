import type React from "react";
import type * as Dialog from "@radix-ui/react-dialog";
import { BaseDialog } from "./BaseDialog";
import { DialogTextInput } from "./DialogTextInput";

type DialogContentProps = React.ComponentPropsWithoutRef<typeof Dialog.Content>;

interface TextInputOperationDialogProps {
  children?: React.ReactNode;
  errorMessage: string | null;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onFocus?: (input: HTMLInputElement) => void;
  onOpenAutoFocus?: DialogContentProps["onOpenAutoFocus"];
  onSubmit: () => void;
  onValueChange: (value: string) => void;
  submitAutoFocus?: boolean;
  submitLabel?: string;
  title: string;
  value: string;
}

export const TextInputOperationDialog = ({
  children,
  errorMessage,
  inputRef,
  isOpen,
  isSubmitting,
  onClose,
  onFocus,
  onOpenAutoFocus,
  onSubmit,
  onValueChange,
  submitAutoFocus = false,
  submitLabel,
  title,
  value,
}: TextInputOperationDialogProps) => (
  <BaseDialog
    isOpen={isOpen}
    onClose={onClose}
    onSubmit={onSubmit}
    title={title}
    submitLabel={submitLabel}
    submitAutoFocus={submitAutoFocus}
    isSubmitting={isSubmitting}
    errorMessage={errorMessage}
    onOpenAutoFocus={onOpenAutoFocus}
  >
    {children}
    <DialogTextInput
      inputRef={inputRef}
      onFocus={onFocus}
      value={value}
      onValueChange={onValueChange}
    />
  </BaseDialog>
);
