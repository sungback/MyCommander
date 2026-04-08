import { describe, it, expect } from "vitest";
import { formatSize, formatDate } from "./format";

describe("formatSize", () => {
  it("returns empty string for null or undefined", () => {
    expect(formatSize(null)).toBe("");
    expect(formatSize(undefined)).toBe("");
  });

  it("formats 0 bytes", () => {
    expect(formatSize(0)).toBe("0 B");
  });

  it("formats bytes below 1 KB", () => {
    expect(formatSize(512)).toBe("512 B");
  });

  it("formats exact KB boundary", () => {
    expect(formatSize(1024)).toBe("1.0 KB");
  });

  it("formats MB range", () => {
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatSize(1536 * 1024)).toBe("1.5 MB");
  });

  it("formats GB with 2 decimal places", () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe("1.00 GB");
  });

  it("formats TB with 2 decimal places", () => {
    expect(formatSize(1024 * 1024 * 1024 * 1024)).toBe("1.00 TB");
  });

  it("uses base 1000 when specified", () => {
    expect(formatSize(1000, { base: 1000 })).toBe("1.0 KB");
    expect(formatSize(1000000, { base: 1000 })).toBe("1.0 MB");
  });

  it("defaults to base 1024", () => {
    // 1000 bytes in base 1024 should still be bytes
    expect(formatSize(1000)).toBe("1000 B");
  });
});

describe("formatDate", () => {
  it("returns empty string for null, undefined, or 0", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate(0)).toBe("");
  });

  it("formats a known timestamp correctly", () => {
    // 2024-01-15 10:30 UTC
    const ts = new Date("2024-01-15T10:30:00Z").getTime();
    const result = formatDate(ts);

    // Verify format pattern: yyyy.MM.dd HH:mm
    expect(result).toMatch(/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/);
    expect(result).toContain("2024.01.15");
  });
});
