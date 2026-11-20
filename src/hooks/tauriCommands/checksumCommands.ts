import { invoke } from "@tauri-apps/api/core";

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

  cancelChecksum: async (jobId: string): Promise<void> => {
    await invoke("cancel_checksum", { job_id: jobId });
  },
};
