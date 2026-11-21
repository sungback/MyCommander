import React, { useEffect, useState } from "react";
import { BaseDialog } from "./BaseDialog";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import type { FileAttributes } from "../../hooks/tauriCommands/fileCommands";
import { useDialogStore } from "../../store/dialogStore";
import { refreshPanelsForDirectories } from "../../store/panelRefresh";
import { showTransientToast } from "../../store/toastStore";
import {
  formatLocalDateTimeInput,
  parseLocalDateTimeInput,
  truncateToSecond,
} from "../../utils/attributesFormat";
import { getPathDirectoryName } from "../../utils/path";

// 선택한 항목 자체의 수정 시간과 읽기 전용 표시를 바꾸는 대화상자. 하위 항목에는 적용하지 않는다.
export const FileAttributesDialog: React.FC = () => {
  const isOpen = useDialogStore((state) => state.openDialog === "attributes");
  const dialogTarget = useDialogStore((state) => state.dialogTarget);
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const fs = useFileSystem();

  const [attributes, setAttributes] = useState<FileAttributes | null>(null);
  const [modifiedInput, setModifiedInput] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetPath = dialogTarget?.path ?? null;

  // 열릴 때마다 현재 속성을 읽어 입력창을 채운다. 닫히거나 대상이 바뀌면 늦게 온 응답은 버린다.
  useEffect(() => {
    if (!isOpen || !targetPath) {
      return;
    }
    let cancelled = false;
    setAttributes(null);
    setError(null);
    setIsLoading(true);
    void fs
      .getFileAttributes(targetPath)
      .then((loaded) => {
        if (cancelled) return;
        setAttributes(loaded);
        setModifiedInput(loaded.modifiedMs === null ? "" : formatLocalDateTimeInput(loaded.modifiedMs));
        setReadOnly(loaded.readOnly);
        setIsLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("Failed to read file attributes:", loadError);
        setError(getErrorMessage(loadError, "속성을 읽지 못했습니다."));
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fs, isOpen, targetPath]);

  const handleSubmit = async () => {
    if (!attributes || !targetPath || isSubmitting) {
      return;
    }

    // 바뀐 값만 보낸다. 입력창은 초 단위라서 원래 값의 밀리초는 버리고 비교한다.
    let nextModifiedMs: number | null = null;
    const originalSecond =
      attributes.modifiedMs === null ? null : truncateToSecond(attributes.modifiedMs);
    if (modifiedInput.trim() !== "") {
      const parsed = parseLocalDateTimeInput(modifiedInput);
      if (parsed === null) {
        setError("수정 시간 형식이 올바르지 않습니다.");
        return;
      }
      if (parsed !== originalSecond) {
        nextModifiedMs = parsed;
      }
    }
    const nextReadOnly = readOnly !== attributes.readOnly ? readOnly : null;

    if (nextModifiedMs === null && nextReadOnly === null) {
      closeDialog();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await fs.setFileAttributes(targetPath, nextModifiedMs, nextReadOnly);
      refreshPanelsForDirectories([getPathDirectoryName(targetPath)], "file-operation");
      showTransientToast("속성을 바꿨습니다.");
      closeDialog();
    } catch (submitError) {
      console.error("Failed to set file attributes:", submitError);
      setError(getErrorMessage(submitError, "속성을 바꾸지 못했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditable = attributes !== null && !attributes.isSymlink;

  return (
    <BaseDialog
      title="Edit Attributes"
      isOpen={isOpen}
      onClose={closeDialog}
      onSubmit={() => void handleSubmit()}
      submitLabel={isSubmitting ? "저장 중..." : "저장"}
      errorMessage={error}
      isSubmitting={isSubmitting || isLoading || !isEditable}
    >
      <div className="text-xs text-text-secondary break-all">{targetPath}</div>
      {isLoading ? <p className="text-xs text-text-secondary">읽는 중입니다.</p> : null}
      {attributes?.isSymlink ? (
        <p className="text-xs text-yellow-400">심볼릭 링크의 속성은 바꿀 수 없습니다.</p>
      ) : null}
      {attributes ? (
        <>
          <label className="block text-xs space-y-1">
            <span className="text-text-secondary">수정 시간 (로컬 시간)</span>
            <input
              type="datetime-local"
              step={1}
              value={modifiedInput}
              disabled={!isEditable}
              onChange={(event) => setModifiedInput(event.target.value)}
              className="w-full bg-bg-primary border border-border-color rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={readOnly}
              disabled={!isEditable}
              onChange={(event) => setReadOnly(event.target.checked)}
            />
            읽기 전용
          </label>
          <p className="text-xs text-text-secondary">
            선택한 항목 자체만 바꾸며 폴더 안의 항목에는 적용하지 않습니다.
          </p>
        </>
      ) : null}
    </BaseDialog>
  );
};
