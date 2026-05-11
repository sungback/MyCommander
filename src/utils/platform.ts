export const isMacPlatform = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.navigator.platform.toUpperCase().includes("MAC");
};
