import { describe, expect, it } from "vitest";
import { matchesWildcard, wildcardToRegExp } from "./wildcardMatch";

describe("wildcardToRegExp", () => {
  it("converts simple extension wildcard", () => {
    const reg = wildcardToRegExp("*.png");
    expect(reg.test("image.png")).toBe(true);
    expect(reg.test("image.PNG")).toBe(true);
    expect(reg.test("image.jpg")).toBe(false);
    expect(reg.test("image.png.bak")).toBe(false);
  });

  it("handles * and *.* as matching any string", () => {
    expect(wildcardToRegExp("*").test("anything")).toBe(true);
    expect(wildcardToRegExp("*.*").test("Makefile")).toBe(true);
    expect(wildcardToRegExp("*.*").test("file.txt")).toBe(true);
  });

  it("handles ? single character wildcard", () => {
    const reg = wildcardToRegExp("file?.txt");
    expect(reg.test("file1.txt")).toBe(true);
    expect(reg.test("fileA.txt")).toBe(true);
    expect(reg.test("file12.txt")).toBe(false);
    expect(reg.test("file.txt")).toBe(false);
  });

  it("escapes regex special characters safely", () => {
    const reg = wildcardToRegExp("data (1)+[v2].*");
    expect(reg.test("data (1)+[v2].json")).toBe(true);
    expect(reg.test("data (1)+[v2].xml")).toBe(true);
    expect(reg.test("data 1+v2.json")).toBe(false);
  });

  it("respects caseSensitive option when true", () => {
    const reg = wildcardToRegExp("*.txt", true);
    expect(reg.test("readme.txt")).toBe(true);
    expect(reg.test("readme.TXT")).toBe(false);
  });
});

describe("matchesWildcard", () => {
  it("returns false for empty pattern", () => {
    expect(matchesWildcard("test.txt", "")).toBe(false);
    expect(matchesWildcard("test.txt", "   ")).toBe(false);
  });

  it("matches single pattern", () => {
    expect(matchesWildcard("app.log", "*.log")).toBe(true);
    expect(matchesWildcard("app.log", "*.txt")).toBe(false);
  });

  it("matches multiple patterns separated by semicolon or comma", () => {
    expect(matchesWildcard("photo.jpg", "*.png; *.jpg; *.gif")).toBe(true);
    expect(matchesWildcard("photo.png", "*.png; *.jpg; *.gif")).toBe(true);
    expect(matchesWildcard("photo.bmp", "*.png; *.jpg; *.gif")).toBe(false);

    expect(matchesWildcard("main.ts", "*.ts, *.tsx")).toBe(true);
    expect(matchesWildcard("App.tsx", "*.ts, *.tsx")).toBe(true);
    expect(matchesWildcard("index.js", "*.ts, *.tsx")).toBe(false);
  });

  it("matches prefix and suffix combinations", () => {
    expect(matchesWildcard("test_unit_01.spec.ts", "test_*.spec.*")).toBe(true);
    expect(matchesWildcard("prod_01.spec.ts", "test_*.spec.*")).toBe(false);
  });
});
