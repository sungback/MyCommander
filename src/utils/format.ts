import { format } from "date-fns";

interface FormatSizeOptions {
  base?: 1000 | 1024;
}

export const formatSize = (size?: number | null, options: FormatSizeOptions = {}) => {
  if (size === undefined || size === null) return "";

  const base = options.base ?? 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];

  let value = size;
  let unitIndex = 0;

  while (value >= base && unitIndex < units.length - 1) {
    value /= base;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${value} ${units[unitIndex]}`;
  }

  const decimals = unitIndex >= 3 ? 2 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

export const formatDate = (ts?: number | string | Date | null) => {
  if (!ts) return "";
  const date = typeof ts === "string" || typeof ts === "number" ? new Date(ts) : ts;
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy.MM.dd HH:mm");
};

/** 계산한 시각이 지금으로부터 얼마나 지났는지 "3일 전" 같은 문구로 만든다. 시각이 없으면 빈 문자열. */
export const formatElapsedSince = (timestamp?: number | null, now: number = Date.now()) => {
  if (!timestamp || !Number.isFinite(timestamp)) return "";

  const elapsedMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  return `${Math.floor(hours / 24)}일 전`;
};
