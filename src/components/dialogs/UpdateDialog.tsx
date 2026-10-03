import React, { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Download, ExternalLink, Rocket, TriangleAlert, X } from "lucide-react";
import { marked } from "marked";
import { useDialogStore } from "../../store/dialogStore";
import { useUpdateStore } from "../../store/updateStore";
import { formatDate } from "../../utils/format";

export const UpdateDialog: React.FC = () => {
  const openDialog = useDialogStore((s) => s.openDialog);
  const closeDialog = useDialogStore((s) => s.closeDialog);

  const {
    currentVersion,
    status,
    errorMessage,
    updateInfo,
    skipVersion,
    openDownloadUrl,
    openReleasePage,
  } = useUpdateStore();

  const [skipThisVersion, setSkipThisVersion] = useState(false);

  const isResultView = status === "latest" || status === "error";
  const isOpen =
    openDialog === "update" &&
    (isResultView || (status === "available" && updateInfo !== null));

  const notesHtml = useMemo(() => {
    if (!updateInfo?.releaseNotes) return "";
    try {
      const parsed = marked.parse(updateInfo.releaseNotes);
      return typeof parsed === "string" ? parsed : "";
    } catch {
      return "";
    }
  }, [updateInfo?.releaseNotes]);

  if (!isOpen) return null;

  if (isResultView) {
    const isError = status === "error";
    return (
      <Dialog.Root open onOpenChange={(open) => !open && closeDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded-lg shadow-2xl w-[420px] max-w-[90vw] z-50 p-5 focus:outline-none text-text-primary"
            aria-describedby="update-result-description"
          >
            <div className="flex items-center space-x-2 mb-3">
              {isError ? (
                <TriangleAlert className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              )}
              <Dialog.Title className="text-base font-bold">
                {isError ? "업데이트 확인 실패" : "최신 버전입니다"}
              </Dialog.Title>
            </div>
            <Dialog.Description
              id="update-result-description"
              className="text-sm text-text-secondary break-words"
            >
              {isError
                ? errorMessage || "업데이트 정보를 가져오지 못했습니다."
                : `현재 최신 버전(v${currentVersion})을 사용하고 있습니다.`}
            </Dialog.Description>
            <div className="flex justify-end space-x-2 mt-5">
              {isError && (
                <button
                  onClick={() => void openReleasePage()}
                  className="text-xs px-3.5 py-1.5 rounded border border-border-color hover:bg-hover-item transition-colors"
                >
                  릴리즈 페이지
                </button>
              )}
              <button
                onClick={closeDialog}
                className="text-xs px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                확인
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (!updateInfo) return null;

  const handleClose = () => {
    if (skipThisVersion && updateInfo) {
      skipVersion(updateInfo.version);
    }
    closeDialog();
  };

  const handleDownload = async () => {
    await openDownloadUrl();
    closeDialog();
  };

  const handleViewReleases = async () => {
    await openReleasePage();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded-lg shadow-2xl w-[540px] max-w-[90vw] z-50 p-5 focus:outline-none text-text-primary"
          aria-describedby="update-dialog-description"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-color pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-md">
                <Rocket className="w-5 h-5" />
              </div>
              <Dialog.Title className="text-base font-bold">
                새로운 버전이 출시되었습니다
              </Dialog.Title>
            </div>
            <Dialog.Description className="sr-only">
              MyCommander 최신 릴리즈 정보 및 업데이트 다운로드 창
            </Dialog.Description>
            <button
              onClick={handleClose}
              className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-hover-item transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div id="update-dialog-description" className="space-y-4">
            {/* Version Badge Bar */}
            <div className="flex items-center justify-between bg-bg-main p-3 rounded-md border border-border-color text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-text-secondary">현재 버전:</span>
                <span className="font-mono text-text-primary font-medium">
                  v{currentVersion}
                </span>
                <span className="text-text-secondary">➔</span>
                <span className="font-mono text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded">
                  v{updateInfo.version}
                </span>
              </div>
              {updateInfo.publishedAt && (
                <span className="text-xs text-text-secondary">
                  {formatDate(updateInfo.publishedAt)}
                </span>
              )}
            </div>

            {/* Release Notes */}
            <div>
              <p className="text-xs text-text-secondary font-medium mb-1.5">
                릴리즈 정보
              </p>
              <div className="max-h-56 overflow-y-auto p-3 bg-bg-main rounded-md border border-border-color text-xs leading-relaxed text-text-secondary">
                {notesHtml ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1"
                    dangerouslySetInnerHTML={{ __html: notesHtml }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{updateInfo.releaseNotes || "새로운 변경 사항이 포함되어 있습니다."}</p>
                )}
              </div>
            </div>

            {/* Target installer note */}
            {updateInfo.assetName && (
              <p className="text-xs text-text-secondary">
                다운로드 대상 파일:{" "}
                <span className="font-mono font-medium text-text-primary">
                  {updateInfo.assetName}
                </span>
              </p>
            )}

            {/* Skip checkbox */}
            <label className="flex items-center space-x-2 cursor-pointer pt-1 text-xs text-text-secondary select-none">
              <input
                type="checkbox"
                checked={skipThisVersion}
                onChange={(e) => setSkipThisVersion(e.target.checked)}
                className="rounded border-border-color text-blue-500 focus:ring-0 cursor-pointer"
              />
              <span>이 버전(v{updateInfo.version}) 알림 건너뛰기</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between border-t border-border-color pt-4 mt-5">
            <button
              onClick={handleViewReleases}
              className="flex items-center space-x-1.5 text-xs text-text-secondary hover:text-text-primary px-2.5 py-1.5 rounded hover:bg-hover-item transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>릴리즈 페이지</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleClose}
                className="text-xs px-3.5 py-1.5 rounded border border-border-color hover:bg-hover-item transition-colors"
              >
                나중에
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center space-x-1.5 text-xs px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>지금 다운로드</span>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
