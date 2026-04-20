import '@testing-library/jest-dom';
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  try {
    globalThis.localStorage?.clear?.();
  } catch {
    // Ignore environments where localStorage is unavailable or readonly.
  }
  cleanup();
});
