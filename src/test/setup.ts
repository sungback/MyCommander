import '@testing-library/jest-dom';
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  try {
    globalThis.localStorage?.clear?.();
  } catch {
    // Ignore environments where localStorage is unavailable or readonly.
  }
  vi.clearAllMocks();
  vi.useRealTimers();
  cleanup();
});
