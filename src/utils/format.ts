import { format } from "date-fns";

export const formatSize = (size?: number | null) => {
  if (size === undefined || size === null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const formatDate = (ts?: number | null) => {
  if (!ts) return "";
  return format(new Date(ts), "yyyy.MM.dd HH:mm");
};
