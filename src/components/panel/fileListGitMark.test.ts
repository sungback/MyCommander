import { describe, expect, it } from "vitest";
import type { GitStatus } from "../../store/gitStatusStore";
import type { FileEntry } from "../../types/file";
import { getGitMarkForEntry } from "./fileListGitMark";

const gitStatus: GitStatus = {
  branch: "main",
  modified: ["changed.txt", "src/App.tsx"],
  added: ["new.txt"],
  deleted: ["old.txt"],
  untracked: ["draft.md"],
};

const fileEntry = (name: string): FileEntry => ({
  name,
  path: `/repo/${name}`,
  kind: "file",
});

const directoryEntry = (name: string): FileEntry => ({
  name,
  path: `/repo/${name}`,
  kind: "directory",
});

describe("getGitMarkForEntry", () => {
  it("returns the direct mark for changed files", () => {
    expect(getGitMarkForEntry(fileEntry("changed.txt"), gitStatus)).toBe("M");
    expect(getGitMarkForEntry(fileEntry("new.txt"), gitStatus)).toBe("A");
    expect(getGitMarkForEntry(fileEntry("old.txt"), gitStatus)).toBe("D");
    expect(getGitMarkForEntry(fileEntry("draft.md"), gitStatus)).toBe("?");
  });

  it("returns a folder mark when any child path is changed", () => {
    expect(getGitMarkForEntry(directoryEntry("src"), gitStatus)).toBe("~");
  });

  it("returns no mark when there is no git status or matching path", () => {
    expect(getGitMarkForEntry(fileEntry("clean.txt"), gitStatus)).toBeUndefined();
    expect(getGitMarkForEntry(directoryEntry("docs"), gitStatus)).toBeUndefined();
    expect(getGitMarkForEntry(fileEntry("changed.txt"), null)).toBeUndefined();
  });
});
