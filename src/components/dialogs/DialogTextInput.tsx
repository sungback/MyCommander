import React from "react";

const dialogTextInputClassName =
  "w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected selection:text-white";

interface DialogTextInputProps {
  value: string;
  onValueChange: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  onFocus?: (input: HTMLInputElement) => void;
}

export const DialogTextInput: React.FC<DialogTextInputProps> = ({
  value,
  onValueChange,
  inputRef,
  onFocus,
}) => (
  <input
    autoFocus
    ref={inputRef}
    onFocus={(event) => onFocus?.(event.currentTarget)}
    autoCorrect="off"
    autoCapitalize="off"
    spellCheck={false}
    value={value}
    onChange={(event) => onValueChange(event.target.value)}
    className={dialogTextInputClassName}
  />
);
