import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RENDERER_RECOVERY_ATTR,
  RENDERER_RECOVERY_CLASS,
  RENDERER_RECOVERY_RELOAD_ATTR,
  pulseRendererSurface,
  recoverRendererSurface,
  reloadRendererSurface,
  setRendererRecoveryReloadForTests,
} from "./useRendererRecovery";

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: vi.fn(() => ({ show: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    show: vi.fn().mockResolvedValue(undefined),
    onFocusChanged: vi.fn().mockResolvedValue(() => {}),
  })),
}));

describe("pulseRendererSurface", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("returns false when #root element is absent", () => {
    root.remove();
    expect(pulseRendererSurface()).toBe(false);
  });

  it("returns true and sets RENDERER_RECOVERY_ATTR when #root is present", () => {
    const before = Date.now();
    const result = pulseRendererSurface();
    const after = Date.now();

    expect(result).toBe(true);
    const attrValue = Number(root.getAttribute(RENDERER_RECOVERY_ATTR));
    expect(attrValue).toBeGreaterThanOrEqual(before);
    expect(attrValue).toBeLessThanOrEqual(after);
  });

  it("adds RENDERER_RECOVERY_CLASS then removes it via requestAnimationFrame", () => {
    let frameCallback: FrameRequestCallback | null = null;
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        frameCallback = cb;
        return 1;
      });

    pulseRendererSurface();

    expect(root.classList.contains(RENDERER_RECOVERY_CLASS)).toBe(true);

    frameCallback!(Date.now());

    expect(root.classList.contains(RENDERER_RECOVERY_CLASS)).toBe(false);

    rafSpy.mockRestore();
  });
});

describe("reloadRendererSurface", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    sessionStorage.clear();
  });

  afterEach(() => {
    root.remove();
    setRendererRecoveryReloadForTests(undefined);
  });

  it("sets RENDERER_RECOVERY_RELOAD_ATTR on #root", () => {
    const mockReload = vi.fn();
    setRendererRecoveryReloadForTests(mockReload);

    const before = Date.now();
    reloadRendererSurface();
    const after = Date.now();

    const attrValue = Number(root.getAttribute(RENDERER_RECOVERY_RELOAD_ATTR));
    expect(attrValue).toBeGreaterThanOrEqual(before);
    expect(attrValue).toBeLessThanOrEqual(after);
  });

  it("calls the function injected via setRendererRecoveryReloadForTests", () => {
    const mockReload = vi.fn();
    setRendererRecoveryReloadForTests(mockReload);

    reloadRendererSurface();

    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it("stores reload timestamp in sessionStorage", () => {
    const mockReload = vi.fn();
    setRendererRecoveryReloadForTests(mockReload);

    const before = Date.now();
    reloadRendererSurface();
    const after = Date.now();

    const stored = Number(sessionStorage.getItem("mycommander:renderer-recovery-reload-at"));
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(after);
  });
});

describe("recoverRendererSurface", () => {
  afterEach(() => {
    document.getElementById("root")?.remove();
  });

  it("returns false when #root is absent", () => {
    expect(recoverRendererSurface()).toBe(false);
  });

  it("returns true (pulse result) when #root is present", () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    expect(recoverRendererSurface()).toBe(true);
  });
});
