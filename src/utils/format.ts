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
