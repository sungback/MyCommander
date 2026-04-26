import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const RENDERER_RECOVERY_CLASS = "renderer-recovery-pulse";
export const RENDERER_RECOVERY_ATTR = "data-renderer-recovery-at";
export const RENDERER_RECOVERY_STALE_MS = 2 * 60 * 1000;
const RENDERER_RECOVERY_CHECK_MS = 30 * 1000;

const isDocumentVisible = () => document.visibilityState !== "hidden";

const requestFrame = (callback: FrameRequestCallback) => {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(Date.now()), 16);
};

const cancelFrame = (frameId: number) => {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frameId);
    return;
  }

  window.clearTimeout(frameId);
};

const restoreNativeSurface = async () => {
  try {
    const appWindow = getCurrentWindow();
    const webview = getCurrentWebview();

    await Promise.allSettled([appWindow.show(), webview.show()]);
  } catch {
    // The Tauri globals are unavailable in browser-only tests and previews.
  }
};

export const pulseRendererSurface = () => {
  const root = document.getElementById("root");

  if (!root) {
    return false;
  }

  root.setAttribute(RENDERER_RECOVERY_ATTR, String(Date.now()));
  root.classList.remove(RENDERER_RECOVERY_CLASS);
  void root.offsetHeight;
  root.classList.add(RENDERER_RECOVERY_CLASS);

  requestFrame(() => {
    root.classList.remove(RENDERER_RECOVERY_CLASS);
  });

  return true;
};

export const recoverRendererSurface = () => {
  const pulsed = pulseRendererSurface();

  void restoreNativeSurface();

  return pulsed;
};

export function useRendererRecovery() {
  useEffect(() => {
    let lastTickAt = Date.now();
    let recoveryFrameId: number | undefined;
    let unlistenNativeFocus: (() => void) | undefined;
    let isDisposed = false;

    const scheduleRecovery = () => {
      if (!isDocumentVisible() || recoveryFrameId !== undefined) {
        return;
      }

      recoveryFrameId = requestFrame(() => {
        recoveryFrameId = undefined;
        recoverRendererSurface();
      });
    };

    const handleForeground = () => {
      lastTickAt = Date.now();
      scheduleRecovery();
    };

    const handleVisibilityChange = () => {
      if (isDocumentVisible()) {
        handleForeground();
      }
    };

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickAt;
      lastTickAt = now;

      if (elapsed >= RENDERER_RECOVERY_STALE_MS) {
        scheduleRecovery();
      }
    }, RENDERER_RECOVERY_CHECK_MS);

    window.addEventListener("focus", handleForeground);
    window.addEventListener("pageshow", handleForeground);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    try {
      void getCurrentWindow()
        .onFocusChanged((event) => {
          if (event.payload) {
            handleForeground();
          }
        })
        .then((unlisten) => {
          if (isDisposed) {
            unlisten();
            return;
          }

          unlistenNativeFocus = unlisten;
        })
        .catch(() => {
          // Ignore non-Tauri browser environments.
        });
    } catch {
      // Ignore non-Tauri browser environments.
    }

    return () => {
      isDisposed = true;

      if (recoveryFrameId !== undefined) {
        cancelFrame(recoveryFrameId);
      }

      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("pageshow", handleForeground);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unlistenNativeFocus?.();
    };
  }, []);
}
