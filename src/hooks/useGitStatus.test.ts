import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGitStatus } from "./useGitStatus";
import { useGitStatusStore, type GitStatus } from "../store/gitStatusStore";

const { mockGetGitStatus } = vi.hoisted(() => ({
  mockGetGitStatus: vi.fn(),
}));

vi.mock("./useFileSystem", () => ({
  useFileSystem: () => ({
    getGitStatus: mockGetGitStatus,
  }),
}));

const cleanStatus: GitStatus = {
  branch: "main",
  modified: [],
  added: [],
  deleted: [],
  untracked: [],
};

describe("useGitStatus", () => {
  beforeEach(() => {
    useGitStatusStore.getState().clear();
    mockGetGitStatus.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deduplicates simultaneous status requests for the same path", async () => {
    mockGetGitStatus.mockResolvedValue(cleanStatus);

    const first = renderHook(() => useGitStatus("/repo"));
    const second = renderHook(() => useGitStatus("/repo"));

    await waitFor(() => {
      expect(first.result.current.gitStatus?.branch).toBe("main");
      expect(second.result.current.gitStatus?.branch).toBe("main");
    });
    expect(mockGetGitStatus).toHaveBeenCalledTimes(1);
  });

  it("caches failed git probes briefly so broken git installs are not retried immediately", async () => {
    mockGetGitStatus.mockRejectedValueOnce(new Error("git.exe failed"));

    const first = renderHook(() => useGitStatus("/repo"));

    await waitFor(() => {
      expect(first.result.current.isLoading).toBe(false);
    });

    renderHook(() => useGitStatus("/repo"));

    await waitFor(() => {
      expect(mockGetGitStatus).toHaveBeenCalledTimes(1);
    });
  });
});
