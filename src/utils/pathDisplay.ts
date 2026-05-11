import { isMacPlatform } from "./platform";

export const MAC_ROOT_DISPLAY_NAME = "Macintosh HD";

export const getPathDisplayName = (path: string) => {
  const normalized = path.replace(/[\\/]+$/, "") || path;

  if (normalized === "/") {
    return isMacPlatform() ? MAC_ROOT_DISPLAY_NAME : "/";
  }

  if (/^[A-Z]:$/i.test(normalized)) {
    return `${normalized}\\`;
  }

  return normalized.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? normalized;
};

export const getBreadcrumbDisplayLabel = (path: string, fallbackLabel: string) =>
  path === "/" ? getPathDisplayName(path) : fallbackLabel;
