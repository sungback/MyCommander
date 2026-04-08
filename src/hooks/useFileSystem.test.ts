import { describe, it, expect } from "vitest";
import { getErrorMessage } from "./useFileSystem";

describe("getErrorMessage", () => {
  const fallback = "Something went wrong";

  it("extracts message from Error object", () => {
    expect(getErrorMessage(new Error("disk full"), fallback)).toBe("disk full");
  });

  it("extracts message from TypeError", () => {
    expect(getErrorMessage(new TypeError("invalid path"), fallback)).toBe(
      "invalid path"
    );
  });

  it("returns string error as-is", () => {
    expect(getErrorMessage("permission denied", fallback)).toBe(
      "permission denied"
    );
  });

  it("extracts message property from plain object", () => {
    expect(getErrorMessage({ message: "not found" }, fallback)).toBe(
      "not found"
    );
  });

  it("returns fallback for null", () => {
    expect(getErrorMessage(null, fallback)).toBe(fallback);
  });

  it("returns fallback for undefined", () => {
    expect(getErrorMessage(undefined, fallback)).toBe(fallback);
  });

  it("returns fallback for empty string", () => {
    expect(getErrorMessage("", fallback)).toBe(fallback);
  });

  it("returns fallback for whitespace-only string", () => {
    expect(getErrorMessage("   ", fallback)).toBe(fallback);
  });

  it("returns fallback for object without message", () => {
    expect(getErrorMessage({ code: 404 }, fallback)).toBe(fallback);
  });

  it("returns fallback for number", () => {
    expect(getErrorMessage(42, fallback)).toBe(fallback);
  });
});
