import React, { useCallback, useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { BaseDialog } from "./BaseDialog";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import {
  CHECKSUM_CANCELLED_ERROR,
  type ChecksumAlgorithm,
  type ChecksumFileResult,
  type ChecksumVerifyEntry,
} from "../../hooks/tauriCommands/checksumCommands";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { showTransientToast } from "../../store/toastStore";
import type { PanelState } from "../../types/file";
import { writeClipboardText } from "../../utils/clipboard";
import {
  CHECKSUM_ALGORITHMS,
  formatChecksumClipboardText,
  formatChecksumFileText,
  getChecksumFileExtension,
  isChecksumFileName,
  summarizeVerifyEntries,
} from "../../utils/checksumFormat";

const STATUS_LABEL: Record<ChecksumVerifyEntry["status"], string> = {
  ok: "일치",
  mismatch: "불일치",
  missing: "파일 없음",
  error: "오류",
};

const STATUS_CLASS: Record<ChecksumVerifyEntry["status"], string> = {
  ok: "text-green-400",
  mismatch: "text-red-400",
  missing: "text-yellow-400",
  error: "text-red-400",
};

let jobCounter = 0;
const nextJobId = () => `checksum-${Date.now()}-${jobCounter++}`;

// 선택 항목(없으면 커서 항목)의 경로. 폴더와 ..은 제외한다.
const getTargetPaths = (panel: PanelState): string[] => {
  const selected = Array.from(panel.selectedItems);
  const candidates =
    selected.length > 0
      ? selected
      : panel.files[panel.cursorIndex] && panel.files[panel.cursorIndex].name !== ".."
        ? [panel.files[panel.cursorIndex].path]
        : [];
  const kindByPath = new Map(panel.files.map((file) => [file.path, file.kind]));
  return candidates.filter((path) => kindByPath.get(path) !== "directory");
};

const getActivePanel = (): PanelState => {
  const state = usePanelStore.getState();
  return state.activePanel === "left" ? state.leftPanel : state.rightPanel;
};

const getBaseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

export const ChecksumDialog: React.FC = () => {
  const isOpen = useDialogStore((state) => state.openDialog === "checksum");
  const mode = useDialogStore((state) => state.checksumMode);
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const fs = useFileSystem();

  const [paths, setPaths] = useState<string[]>([]);
  const [algorithms, setAlgorithms] = useState<ChecksumAlgorithm[]>(["sha256"]);
  const [usedAlgorithms, setUsedAlgorithms] = useState<ChecksumAlgorithm[]>([]);
  const [results, setResults] = useState<ChecksumFileResult[] | null>(null);
  const [verifyEntries, setVerifyEntries] = useState<ChecksumVerifyEntry[] | null>(null);
  const [verifySource, setVerifySource] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  // 닫았다가 다시 열 때 이전 실행의 결과가 섞이지 않게 실행 번호로 구분한다.
  const runTokenRef = useRef(0);

  const cancelRunning = useCallback(() => {
    runTokenRef.current += 1;
    const jobId = jobIdRef.current;
    jobIdRef.current = null;
    if (jobId) {
      void fs.cancelChecksum(jobId).catch((cancelError) => {
        console.error("Failed to cancel checksum job:", cancelError);
      });
    }
  }, [fs]);

  const handleClose = useCallback(() => {
    cancelRunning();
    closeDialog();
  }, [cancelRunning, closeDialog]);

  const runVerify = useCallback(
    async (checksumPath: string) => {
      const token = ++runTokenRef.current;
      const jobId = nextJobId();
      jobIdRef.current = jobId;
      setVerifySource(checksumPath);
      setVerifyEntries(null);
      setError(null);
      setIsRunning(true);
      try {
        const entries = await fs.verifyChecksumFile(checksumPath, jobId);
        if (token === runTokenRef.current) {
          setVerifyEntries(entries);
        }
      } catch (runError) {
        const message = getErrorMessage(runError, "체크섬 확인에 실패했습니다.");
        if (token === runTokenRef.current && message !== CHECKSUM_CANCELLED_ERROR) {
          setError(message);
        }
      } finally {
        if (token === runTokenRef.current) {
          jobIdRef.current = null;
          setIsRunning(false);
        }
      }
    },
    [fs]
  );

  const runGenerate = useCallback(async () => {
    if (paths.length === 0 || algorithms.length === 0) {
      return;
    }
    const token = ++runTokenRef.current;
    const jobId = nextJobId();
    jobIdRef.current = jobId;
    const requested = CHECKSUM_ALGORITHMS.map((item) => item.id).filter((id) =>
      algorithms.includes(id)
    );
    setResults(null);
    setError(null);
    setIsRunning(true);
    try {
      const computed = await fs.computeChecksums(paths, requested, jobId);
      if (token === runTokenRef.current) {
        setUsedAlgorithms(requested);
        setResults(computed);
      }
    } catch (runError) {
      const message = getErrorMessage(runError, "체크섬 계산에 실패했습니다.");
      if (token === runTokenRef.current && message !== CHECKSUM_CANCELLED_ERROR) {
        setError(message);
      }
    } finally {
      if (token === runTokenRef.current) {
        jobIdRef.current = null;
        setIsRunning(false);
      }
    }
  }, [algorithms, fs, paths]);

  // 대화상자가 열릴 때마다 상태를 초기화하고, 확인 모드는 체크섬 파일을 정해 바로 실행한다.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setResults(null);
    setVerifyEntries(null);
    setVerifySource(null);
    setError(null);
    setIsRunning(false);

    const panel = getActivePanel();
    if (mode === "generate") {
      const targets = getTargetPaths(panel);
      setPaths(targets);
      if (targets.length === 0) {
        setError("계산할 파일이 없습니다. 파일을 선택하세요.");
      }
      return;
    }

    setPaths([]);
    const opening = ++runTokenRef.current;
    void (async () => {
      const targets = getTargetPaths(panel);
      let checksumPath: string | null =
        targets.length === 1 && isChecksumFileName(getBaseName(targets[0])) ? targets[0] : null;
      if (!checksumPath) {
        try {
          const picked = await open({
            title: "체크섬 파일 선택",
            multiple: false,
            directory: false,
            filters: [{ name: "Checksum", extensions: ["md5", "sha1", "sha256", "sfv"] }],
          });
          checksumPath = typeof picked === "string" ? picked : null;
        } catch (pickError) {
          console.error("Failed to pick checksum file:", pickError);
          setError("체크섬 파일을 선택하지 못했습니다.");
          return;
        }
      }
      if (opening !== runTokenRef.current) {
        return;
      }
      if (!checksumPath) {
        closeDialog();
        return;
      }
      await runVerify(checksumPath);
    })();
    // 열림 상태가 바뀔 때만 실행한다. 이후 선택이 바뀌어도 대상은 열 때 고정한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  const toggleAlgorithm = (algorithm: ChecksumAlgorithm) => {
    setAlgorithms((current) =>
      current.includes(algorithm)
        ? current.filter((id) => id !== algorithm)
        : [...current, algorithm]
    );
  };

  const handleCopy = async () => {
    if (!results) return;
    try {
      await writeClipboardText(formatChecksumClipboardText(results, usedAlgorithms));
      showTransientToast("체크섬을 복사했습니다.");
    } catch (copyError) {
      console.error("Failed to copy checksums:", copyError);
      showTransientToast("클립보드를 사용할 수 없습니다.", { tone: "error" });
    }
  };

  const handleSave = async (algorithm: ChecksumAlgorithm) => {
    if (!results) return;
    const text = formatChecksumFileText(results, algorithm);
    if (!text) {
      showTransientToast("저장할 항목이 없습니다.", { tone: "error" });
      return;
    }
    const extension = getChecksumFileExtension(algorithm);
    try {
      const target = await save({
        title: "체크섬 파일 저장",
        defaultPath: `checksums.${extension}`,
        filters: [{ name: "Checksum", extensions: [extension] }],
      });
      if (!target) return;
      await writeTextFile(target, text);
      showTransientToast("체크섬 파일을 저장했습니다.");
    } catch (saveError) {
      console.error("Failed to save checksum file:", saveError);
      showTransientToast("체크섬 파일을 저장하지 못했습니다.", { tone: "error" });
    }
  };

  const isGenerate = mode === "generate";
  const hasResult = isGenerate ? results !== null : verifyEntries !== null;
  const submitLabel = isRunning ? "계산 중..." : hasResult || !isGenerate ? "닫기" : "계산";
  const handleSubmit = () => {
    if (isRunning) return;
    if (isGenerate && !hasResult && !error) {
      void runGenerate();
      return;
    }
    handleClose();
  };

  const summary = verifyEntries ? summarizeVerifyEntries(verifyEntries) : null;

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title={isGenerate ? "체크섬 생성" : "체크섬 확인"}
      submitLabel={submitLabel}
      errorMessage={error}
      submitAutoFocus={!isGenerate}
    >
      {isGenerate ? (
        <>
          <div className="text-xs text-text-secondary">파일 {paths.length}개</div>
          <div className="flex flex-wrap gap-3 text-xs">
            {CHECKSUM_ALGORITHMS.map((item) => (
              <label key={item.id} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={algorithms.includes(item.id)}
                  disabled={isRunning || results !== null}
                  onChange={() => toggleAlgorithm(item.id)}
                />
                {item.label}
              </label>
            ))}
          </div>
          {isRunning ? (
            <p className="text-xs text-text-secondary">계산 중입니다. 취소하면 중단됩니다.</p>
          ) : null}
          {results ? (
            <>
              <div className="max-h-56 overflow-auto space-y-2 text-xs select-text">
                {results.map((result) => (
                  <div key={result.path}>
                    <div className="font-medium break-all">{result.name}</div>
                    {result.error ? (
                      <div className="text-red-400">{result.error}</div>
                    ) : (
                      result.hashes.map((hash) => (
                        <div key={hash.algorithm} className="font-mono break-all text-text-secondary">
                          {hash.algorithm.toUpperCase()}: {hash.value}
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="px-2 py-0.5 rounded bg-bg-secondary hover:bg-bg-hover border border-border-color"
                >
                  복사
                </button>
                {usedAlgorithms.map((algorithm) => (
                  <button
                    key={algorithm}
                    type="button"
                    onClick={() => void handleSave(algorithm)}
                    className="px-2 py-0.5 rounded bg-bg-secondary hover:bg-bg-hover border border-border-color"
                  >
                    .{getChecksumFileExtension(algorithm)} 파일로 저장
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          {verifySource ? (
            <div className="text-xs text-text-secondary break-all">{verifySource}</div>
          ) : null}
          {isRunning ? <p className="text-xs text-text-secondary">확인 중입니다.</p> : null}
          {summary ? (
            <>
              <div className="text-xs">
                일치 {summary.ok} · 불일치 {summary.mismatch} · 파일 없음 {summary.missing} · 오류{" "}
                {summary.error}
              </div>
              <div className="max-h-56 overflow-auto space-y-1 text-xs select-text">
                {verifyEntries?.map((entry, index) => (
                  <div key={`${entry.name}-${index}`} className="break-all">
                    <span className={STATUS_CLASS[entry.status]}>{STATUS_LABEL[entry.status]}</span>{" "}
                    {entry.name}
                    {entry.error ? (
                      <span className="text-text-secondary"> ({entry.error})</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </BaseDialog>
  );
};
