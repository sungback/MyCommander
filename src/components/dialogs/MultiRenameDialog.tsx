import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import {
  buildMultiRenamePreview,
  defaultMultiRenameOptions,
  getBatchRenameOperations,
  MultiRenameCaseMode,
} from "../../features/multiRename";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";

const CASE_MODE_OPTIONS: Array<{ value: MultiRenameCaseMode; label: string }> = [
  { value: "keep", label: "그대로" },
  { value: "upper", label: "대문자" },
  { value: "lower", label: "소문자" },
  { value: "title", label: "단어 첫 글자 대문자" },
];

export const MultiRenameDialog: React.FC = () => {
  const { openDialog, multiRenameSession, closeDialog } = useDialogStore();
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const fs = useFileSystem();

  const [nameMask, setNameMask] = useState(defaultMultiRenameOptions.nameMask);
  const [extensionMask, setExtensionMask] = useState(defaultMultiRenameOptions.extensionMask);
  const [searchText, setSearchText] = useState(defaultMultiRenameOptions.searchText);
  const [replaceText, setReplaceText] = useState(defaultMultiRenameOptions.replaceText);
  const [caseMode, setCaseMode] = useState<MultiRenameCaseMode>(
    defaultMultiRenameOptions.caseMode
  );
  const [counterStart, setCounterStart] = useState(defaultMultiRenameOptions.counterStart);
  const [counterStep, setCounterStep] = useState(defaultMultiRenameOptions.counterStep);
  const [counterPadding, setCounterPadding] = useState(defaultMultiRenameOptions.counterPadding);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (openDialog !== "multirename") {
      return;
    }

    setNameMask(defaultMultiRenameOptions.nameMask);
    setExtensionMask(defaultMultiRenameOptions.extensionMask);
    setSearchText(defaultMultiRenameOptions.searchText);
    setReplaceText(defaultMultiRenameOptions.replaceText);
    setCaseMode(defaultMultiRenameOptions.caseMode);
    setCounterStart(defaultMultiRenameOptions.counterStart);
    setCounterStep(defaultMultiRenameOptions.counterStep);
    setCounterPadding(defaultMultiRenameOptions.counterPadding);
    setOperationError(null);
    setIsSubmitting(false);
  }, [openDialog, multiRenameSession]);

  const previewRows = multiRenameSession
    ? buildMultiRenamePreview(multiRenameSession, {
        nameMask,
        extensionMask,
        searchText,
        replaceText,
        caseMode,
        counterStart,
        counterStep,
        counterPadding,
      })
    : [];
  const hasErrors = previewRows.some((row) => row.error !== null);
  const operations = getBatchRenameOperations(previewRows);

  const handleSubmit = async () => {
    if (!multiRenameSession || operations.length === 0 || hasErrors) {
      return;
    }

    try {
      setIsSubmitting(true);
      setOperationError(null);
      await fs.applyBatchRename(operations);
      closeDialog();
      refreshPanel(multiRenameSession.panelId);
    } catch (error) {
      console.error("Failed to batch rename items:", error);
      setOperationError(getErrorMessage(error, "일괄 이름 변경을 완료하지 못했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={openDialog === "multirename"} onOpenChange={(open) => !open && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[min(80vh,720px)] w-[min(92vw,980px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded border border-border-color bg-bg-panel p-4 text-text-primary shadow-xl focus:outline-none">
          <Dialog.Title className="border-b border-border-color pb-2 text-sm font-bold">
            일괄 이름 변경 도구
          </Dialog.Title>

          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-text-secondary">이름 마스크</span>
                <input
                  autoFocus
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={nameMask}
                  onChange={(event) => {
                    setNameMask(event.target.value);
                    if (operationError) {
                      setOperationError(null);
                    }
                  }}
                  className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm focus:border-accent-color focus:outline-none"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs text-text-secondary">확장자 마스크</span>
                <input
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={extensionMask}
                  onChange={(event) => {
                    setExtensionMask(event.target.value);
                    if (operationError) {
                      setOperationError(null);
                    }
                  }}
                  className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm focus:border-accent-color focus:outline-none"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-secondary">찾을 문자열</span>
                  <input
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm focus:border-accent-color focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-secondary">바꿀 문자열</span>
                  <input
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={replaceText}
                    onChange={(event) => setReplaceText(event.target.value)}
                    className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm focus:border-accent-color focus:outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-text-secondary">대소문자 변환</span>
                <select
                  value={caseMode}
                  onChange={(event) => setCaseMode(event.target.value as MultiRenameCaseMode)}
                  className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm focus:border-accent-color focus:outline-none"
                >
                  {CASE_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-secondary">카운터 시작</span>
                  <input
                    type="number"
                    value={counterStart}
                    onChange={(event) => setCounterStart(Number(event.target.value) || 0)}
                    className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm focus:border-accent-color focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-secondary">증가값</span>
                  <input
                    type="number"
                    value={counterStep}
                    onChange={(event) => setCounterStep(Number(event.target.value) || 0)}
                    className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm focus:border-accent-color focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-secondary">자리수</span>
                  <input
                    type="number"
                    min={0}
                    value={counterPadding}
                    onChange={(event) => setCounterPadding(Math.max(0, Number(event.target.value) || 0))}
                    className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm focus:border-accent-color focus:outline-none"
                  />
                </label>
              </div>

              <div className="rounded border border-border-color bg-bg-primary/60 p-3 text-xs text-text-secondary">
                <p>사용 가능한 토큰: `[N]` 원래 이름, `[E]` 원래 확장자, `[C]` 카운터</p>
                <p className="mt-1">
                  선택 항목 {multiRenameSession?.items.length ?? 0}개, 적용 대상 폴더:
                  {" "}
                  {multiRenameSession?.directoryPath ?? "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded border border-border-color">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] border-b border-border-color bg-bg-secondary px-3 py-2 text-xs font-semibold text-text-secondary">
              <span>원래 이름</span>
              <span>새 이름</span>
              <span>상태</span>
            </div>
            <div className="h-full overflow-auto">
              {previewRows.length === 0 ? (
                <div className="px-3 py-4 text-sm text-text-secondary">이름을 바꿀 항목이 없습니다.</div>
              ) : (
                previewRows.map((row) => (
                  <div
                    key={row.oldPath}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] items-center border-b border-border-color/60 px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="truncate">{row.oldName}</span>
                    <span className={row.error ? "truncate text-red-400" : "truncate"}>
                      {row.newName || "(빈 이름)"}
                    </span>
                    <span
                      className={
                        row.error
                          ? "text-xs text-red-400"
                          : row.changed
                            ? "text-xs text-emerald-400"
                            : "text-xs text-text-secondary"
                      }
                    >
                      {row.error ?? (row.changed ? "변경됨" : "변경 없음")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-h-[20px] text-xs text-red-400">
              {operationError ?? (hasErrors ? "충돌이나 잘못된 이름을 먼저 해결해 주세요." : "")}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                disabled={isSubmitting}
                className="min-w-[88px] rounded border border-border-color bg-bg-secondary px-4 py-1.5 text-sm transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting || operations.length === 0 || hasErrors}
                className="min-w-[120px] rounded border border-transparent bg-bg-selected px-4 py-1.5 text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "변경 중..." : `이름 변경 ${operations.length}개`}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
