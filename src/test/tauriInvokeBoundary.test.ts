import { describe, expect, it } from "vitest";

const sourceFiles = import.meta.glob("../**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const isAllowedInvokeImport = (path: string) =>
  path.startsWith("../hooks/tauriCommands/");

const importsInvokeFromTauriCore = (source: string) =>
  /import\s*\{[^}]*\binvoke\b[^}]*}\s*from\s*["']@tauri-apps\/api\/core["']/.test(source);

describe("Tauri invoke boundary", () => {
  it("keeps direct invoke imports inside useFileSystem", () => {
    const directInvokeImports = Object.entries(sourceFiles)
      .filter(([path]) => !path.includes(".test.") && !path.startsWith("../test/"))
      .filter(([path, source]) => !isAllowedInvokeImport(path) && importsInvokeFromTauriCore(source))
      .map(([path]) => path.replace(/^\.\.\//, "src/"))
      .sort();

    expect(directInvokeImports).toEqual([]);
  });
});
