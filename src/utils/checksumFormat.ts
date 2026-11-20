import type {
  ChecksumAlgorithm,
  ChecksumFileResult,
  ChecksumVerifyEntry,
} from "../hooks/tauriCommands/checksumCommands";

export const CHECKSUM_ALGORITHMS: { id: ChecksumAlgorithm; label: string }[] = [
  { id: "crc32", label: "CRC32" },
  { id: "md5", label: "MD5" },
  { id: "sha1", label: "SHA-1" },
  { id: "sha256", label: "SHA-256" },
];

const CHECKSUM_FILE_EXTENSIONS = ["md5", "sha1", "sha256", "sfv"];

export const isChecksumFileName = (name: string): boolean => {
  const dotIndex = name.lastIndexOf(".");
  return (
    dotIndex > 0 &&
    CHECKSUM_FILE_EXTENSIONS.includes(name.slice(dotIndex + 1).toLowerCase())
  );
};

export const getChecksumFileExtension = (algorithm: ChecksumAlgorithm): string =>
  algorithm === "crc32" ? "sfv" : algorithm;

// CRC32는 SFV(`이름 해시`), 나머지는 GNU(`해시 *이름`) 형식이다.
export const formatChecksumLine = (
  algorithm: ChecksumAlgorithm,
  value: string,
  name: string
): string => (algorithm === "crc32" ? `${name} ${value}` : `${value} *${name}`);

export const formatChecksumFileText = (
  results: ChecksumFileResult[],
  algorithm: ChecksumAlgorithm
): string => {
  const lines = results.flatMap((result) =>
    result.hashes
      .filter((hash) => hash.algorithm === algorithm)
      .map((hash) => formatChecksumLine(algorithm, hash.value, result.name))
  );
  return lines.length > 0 ? lines.join("\n") + "\n" : "";
};

// 클립보드용: 선택한 알고리즘마다 줄을 이어 붙인다. 해시 길이로 알고리즘을 구분할 수 있다.
export const formatChecksumClipboardText = (
  results: ChecksumFileResult[],
  algorithms: ChecksumAlgorithm[]
): string =>
  algorithms
    .map((algorithm) => formatChecksumFileText(results, algorithm).trimEnd())
    .filter((text) => text.length > 0)
    .join("\n");

export interface ChecksumVerifySummary {
  ok: number;
  mismatch: number;
  missing: number;
  error: number;
}

export const summarizeVerifyEntries = (
  entries: ChecksumVerifyEntry[]
): ChecksumVerifySummary => {
  const summary: ChecksumVerifySummary = { ok: 0, mismatch: 0, missing: 0, error: 0 };
  for (const entry of entries) {
    summary[entry.status] += 1;
  }
  return summary;
};
