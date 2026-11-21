import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ChecksumAlgorithm = "crc32" | "md5" | "sha1" | "sha256";

export interface ChecksumFileResult {
  path: string;
  name: string;
  hashes: { algorithm: ChecksumAlgorithm; value: string }[];
  error: string | null;
}

export type ChecksumVerifyStatus = "ok" | "mismatch" | "missing" | "error";

export interface ChecksumVerifyEntry {
  name: string;
  path: string;
  algorithm: ChecksumAlgorithm;
  expected: string;
  actual: string | null;
  status: ChecksumVerifyStatus;
  error: string | null;
}

// Rust가 계산·확인 중에 보내는 진행 상황(checksum-progress 이벤트)
export interface ChecksumProgress {
  jobId: string;
  // 1부터 센 현재 파일 순번
  fileIndex: number;
  fileCount: number;
  fileName: string;
  bytesDone: number;
  bytesTotal: number;
}

// Rust가 작업 취소 시 돌려주는 오류 문자열
export const CHECKSUM_CANCELLED_ERROR = "cancelled";

export const checksumCommands = {
  computeChecksums: async (
    paths: string[],
    algorithms: ChecksumAlgorithm[],
    jobId: string
  ): Promise<ChecksumFileResult[]> =>
    await invoke<ChecksumFileResult[]>("compute_checksums", {
      paths,
      algorithms,
      job_id: jobId,
    }),

  verifyChecksumFile: async (
    checksumPath: string,
    jobId: string
  ): Promise<ChecksumVerifyEntry[]> =>
    await invoke<ChecksumVerifyEntry[]>("verify_checksum_file", {
      checksum_path: checksumPath,
      job_id: jobId,
    }),

  // 반환값은 구독 해제 함수다.
  onChecksumProgress: async (
    handler: (progress: ChecksumProgress) => void
  ): Promise<() => void> =>
    await listen<ChecksumProgress>("checksum-progress", (event) => handler(event.payload)),

  cancelChecksum: async (jobId: string): Promise<void> => {
    await invoke("cancel_checksum", { job_id: jobId });
  },
};
