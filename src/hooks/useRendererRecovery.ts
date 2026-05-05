import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const RENDERER_RECOVERY_CLASS = "renderer-recovery-pulse";
export const RENDERER_RECOVERY_ATTR = "data-renderer-recovery-at";
export const RENDERER_RECOVERY_RELOAD_ATTR = "data-renderer-recovery-reload-at";
export const RENDERER_RECOVERY_STALE_MS = 2 * 60 * 1000;
export const RENDERER_RECOVERY_RELOAD_DELAY_MS = 1500;
export const RENDERER_RECOVERY_RELOAD_COOLDOWN_MS = 60 * 1000;
const RENDERER_RECOVERY_CHECK_MS = 30 * 1000;
const RENDERER_RECOVERY_RELOAD_STORAGE_KEY = "mycommander:renderer-recovery-reload-at";

type RendererReload = () => void;

let rendererReload: RendererReload = () => {
  window.location.reload();
};

export const setRendererRecoveryReloadForTests = (reload?: RendererReload) => {
  rendererReload = reload ?? (() => window.location.reload());
};

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

const readLastRendererReloadAt = () => {
  try {
    const stored = window.sessionStorage.getItem(RENDERER_RECOVERY_RELOAD_STORAGE_KEY);
    return stored ? Number(stored) || 0 : 0;
  } catch {
    return 0;
  }
};

const markRendererReloadRequested = (requestedAt: number) => {
  const root = document.getElementById("root");
  root?.setAttribute(RENDERER_RECOVERY_RELOAD_ATTR, String(requestedAt));

  try {
    window.sessionStorage.setItem(
      RENDERER_RECOVERY_RELOAD_STORAGE_KEY,
      String(requestedAt),
    );
  } catch {
    // Session storage can be unavailable in browser-only previews.
  }
};

const canAutoReloadRenderer = (now: number) => {
  const lastReloadAt = readLastRendererReloadAt();
  return now - lastReloadAt >= RENDERER_RECOVERY_RELOAD_COOLDOWN_MS;
};

export const reloadRendererSurface = () => {
  const requestedAt = Date.now();
  markRendererReloadRequested(requestedAt);

  try {
    rendererReload();
  } catch {
    // The fallback is best-effort; keep the app usable if reload is blocked.
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
    let recoveryReloadTimeoutId: number | undefined;
    let unlistenNativeFocus: (() => void) | undefined;
    let pendingStaleRecovery = false;
    let isDisposed = false;

    const scheduleRendererReload = () => {
      if (recoveryReloadTimeoutId !== undefined || !canAutoReloadRenderer(Date.now())) {
        return;
      }

      recoveryReloadTimeoutId = window.setTimeout(() => {
        recoveryReloadTimeoutId = undefined;
        reloadRendererSurface();
      }, RENDERER_RECOVERY_RELOAD_DELAY_MS);
    };

    const scheduleRecovery = ({ allowReload = false } = {}) => {
      if (!isDocumentVisible()) {
        return;
      }

      if (recoveryFrameId !== undefined) {
        if (allowReload) {
          scheduleRendererReload();
        }

        return;
      }

      recoveryFrameId = requestFrame(() => {
        recoveryFrameId = undefined;
        recoverRendererSurface();
      });

      if (allowReload) {
        scheduleRendererReload();
      }
    };

    const handleForeground = () => {
      const now = Date.now();
      const wasStale = pendingStaleRecovery || now - lastTickAt >= RENDERER_RECOVERY_STALE_MS;
      pendingStaleRecovery = false;
      lastTickAt = now;
      scheduleRecovery({ allowReload: wasStale });
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
        pendingStaleRecovery = !isDocumentVisible();
        scheduleRecovery({ allowReload: true });
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

      if (recoveryReloadTimeoutId !== undefined) {
        window.clearTimeout(recoveryReloadTimeoutId);
      }

      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("pageshow", handleForeground);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unlistenNativeFocus?.();
    };
  }, []);
}
