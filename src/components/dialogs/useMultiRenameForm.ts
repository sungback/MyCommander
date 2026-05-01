import { useCallback, useState } from "react";
import {
  defaultMultiRenameOptions,
  type MultiRenameOptions,
} from "../../features/multiRename";

export const useMultiRenameForm = () => {
  const [options, setOptions] = useState<MultiRenameOptions>(defaultMultiRenameOptions);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setOptions(defaultMultiRenameOptions);
    setOperationError(null);
    setIsSubmitting(false);
  }, []);

  const updateOption = useCallback(
    <Key extends keyof MultiRenameOptions>(key: Key, value: MultiRenameOptions[Key]) => {
      setOptions((current) => ({
        ...current,
        [key]: value,
      }));
    },
    []
  );

  const clearOperationError = useCallback(() => {
    setOperationError(null);
  }, []);

  return {
    options,
    operationError,
    isSubmitting,
    resetForm,
    updateOption,
    setOperationError,
    clearOperationError,
    setIsSubmitting,
  };
};
