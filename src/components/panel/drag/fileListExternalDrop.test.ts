import { describe, expect, it } from "vitest";
import { getExternalDropPaths } from "./fileListExternalDrop";

describe("fileListExternalDrop", () => {
  it("reads native file paths and skips entries without usable paths", () => {
    const files = {
      0: { path: "/tmp/a.txt" } as unknown as File,
      1: { path: "" } as unknown as File,
      2: {} as File,
      length: 3,
    } satisfies ArrayLike<File>;

    expect(getExternalDropPaths(files)).toEqual(["/tmp/a.txt"]);
  });
});
