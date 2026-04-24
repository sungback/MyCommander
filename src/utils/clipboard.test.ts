import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeClipboardText } from "./clipboard";

const mockExecCommand = vi.fn().mockReturnValue(true);

// jsdom does not define document.execCommand — define it once so vi.spyOn can intercept it
Object.defineProperty(document, "execCommand", {
  value: mockExecCommand,
  writable: true,
  configurable: true,
});

describe("writeClipboardText", () => {
  beforeEach(() => {
    mockExecCommand.mockReturnValue(true);
    mockExecCommand.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("navigator.clipboard.writeText가 있으면 사용한다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await writeClipboardText("hello");

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it("navigator.clipboard가 없으면 execCommand로 폴백한다", async () => {
    await writeClipboardText("fallback text");

    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("navigator.clipboard.writeText가 실패하면 execCommand로 폴백한다", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });

    await writeClipboardText("text");

    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("execCommand가 false를 반환하면 오류를 던진다", async () => {
    vi.spyOn(document, "execCommand").mockReturnValue(false);

    await expect(writeClipboardText("text")).rejects.toThrow("Clipboard unavailable");
  });
});
