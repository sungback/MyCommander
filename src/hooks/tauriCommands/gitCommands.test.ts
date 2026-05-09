import { describe, it, expect, vi, beforeEach } from "vitest";
import { gitCommands } from "./gitCommands";
import type { GitStatus } from "../../store/gitStatusStore";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

beforeEach(() => {
  mockInvoke.mockReset();
});

describe("gitCommands", () => {
  describe("getGitStatus", () => {
    it("calls invoke with correct command and path", async () => {
      const status: GitStatus = {
        branch: "main",
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
      };
      mockInvoke.mockResolvedValue(status);

      await gitCommands.getGitStatus("/some/repo");

      expect(mockInvoke).toHaveBeenCalledWith("get_git_status", { path: "/some/repo" });
    });

    it("returns GitStatus from invoke", async () => {
      const status: GitStatus = {
        branch: "feat/test",
        modified: [],
        added: ["a.ts"],
        deleted: [],
        untracked: ["b.ts"],
      };
      mockInvoke.mockResolvedValue(status);

      const result = await gitCommands.getGitStatus("/some/repo");

      expect(result).toEqual(status);
    });

    it("returns null when path is not a git repo", async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await gitCommands.getGitStatus("/not/a/repo");

      expect(result).toBeNull();
    });
  });
});
