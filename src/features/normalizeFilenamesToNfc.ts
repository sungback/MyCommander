import { refreshPanelsForDirectories } from "../store/panelRefresh";
import { showTransientToast } from "../store/toastStore";
import { getPathDirectoryName } from "../utils/path";
import {
  buildNfcRenameTargetPath,
  hasDecomposedUnicodeFilename,
} from "../utils/unicodeFilename";

export interface NfcRenameFailure {
  path: string;
  message: string;
}

export interface NfcRenameResult {
  /** NFC로 이름이 바뀐 항목의 원래 경로 */
  converted: string[];
  failed: NfcRenameFailure[];
  /** 이미 NFC라서 건드리지 않은 항목 수 */
  unchanged: number;
  /** 이름이 바뀐 항목이 들어 있는 폴더(화면 갱신용) */
  parentDirectories: string[];
}

const getBaseName = (path: string) =>
  path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

/**
 * 경로 목록의 이름을 NFC로 바꾼다. 이미 NFC인 항목은 그대로 두고,
 * 하나가 실패해도 나머지는 계속 진행한다. 덮어쓰기 방지는 renameFile(Rust)이 맡는다.
 */
export const normalizePathsToNfc = async (
  paths: string[],
  renameFile: (oldPath: string, newPath: string) => Promise<void>
): Promise<NfcRenameResult> => {
  const uniquePaths = Array.from(new Set(paths));
  // 하위 경로부터 바꿔야 부모 이름이 바뀐 뒤에도 자식 경로가 유효하다.
  const targets = uniquePaths
    .filter((path) => hasDecomposedUnicodeFilename(getBaseName(path)))
    .sort((a, b) => b.length - a.length);

  const converted: string[] = [];
  const failed: NfcRenameFailure[] = [];

  for (const path of targets) {
    try {
      await renameFile(path, buildNfcRenameTargetPath(path, getBaseName(path)));
      converted.push(path);
    } catch (error) {
      failed.push({
        path,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    converted,
    failed,
    unchanged: uniquePaths.length - targets.length,
    parentDirectories: Array.from(new Set(converted.map(getPathDirectoryName))),
  };
};

export const formatNfcRenameMessage = (result: NfcRenameResult) => {
  const { converted, failed } = result;
  if (converted.length === 0 && failed.length === 0) {
    return "변환할 파일명이 없습니다 (이미 NFC)";
  }
  if (converted.length === 0) {
    return "파일명을 NFC로 변환하지 못했습니다.";
  }
  if (failed.length > 0) {
    return `${converted.length}개 변환, ${failed.length}개 실패했습니다.`;
  }
  return converted.length === 1
    ? "파일명을 NFC로 변환했습니다."
    : `${converted.length}개 파일명을 NFC로 변환했습니다.`;
};

/** 이름을 바꾸고 영향 받은 폴더를 갱신한 뒤 결과를 토스트로 알린다. */
export const runNfcRename = async (
  paths: string[],
  renameFile: (oldPath: string, newPath: string) => Promise<void>
) => {
  const result = await normalizePathsToNfc(paths, renameFile);

  for (const failure of result.failed) {
    console.error(`Failed to convert filename to NFC: ${failure.path}`, failure.message);
  }
  if (result.converted.length > 0) {
    refreshPanelsForDirectories(result.parentDirectories);
  }
  showTransientToast(formatNfcRenameMessage(result), {
    tone: result.failed.length > 0 ? "error" : "info",
  });

  return result;
};
