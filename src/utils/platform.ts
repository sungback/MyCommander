export type PlatformType = "macos" | "windows" | "linux";

export const isMacPlatform = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.navigator.platform.toUpperCase().includes("MAC");
};

export const getPlatformType = (): PlatformType => {
  if (typeof window === "undefined") {
    return "macos";
  }

  const platform = (window.navigator.platform || "").toUpperCase();
  const userAgent = (window.navigator.userAgent || "").toUpperCase();

  if (platform.includes("MAC") || userAgent.includes("MACINTOSH")) {
    return "macos";
  }
  if (platform.includes("WIN") || userAgent.includes("WINDOWS")) {
    return "windows";
  }
  return "linux";
};
