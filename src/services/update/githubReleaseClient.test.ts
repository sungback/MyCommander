import { describe, expect, it, vi } from "vitest";
import {
  fetchLatestRelease,
  findPlatformAsset,
  parseReleaseToUpdateInfo,
  RawGithubRelease,
} from "./githubReleaseClient";

const mockRelease: RawGithubRelease = {
  tag_name: "v1.3.0",
  name: "MyCommander v1.3.0",
  body: "## Improvements\n- Faster updates\n- Bug fixes",
  published_at: "2026-10-03T12:00:00Z",
  html_url: "https://github.com/sungback/MyCommander/releases/tag/v1.3.0",
  assets: [
    {
      name: "MyCommander_1.3.0_aarch64.dmg",
      browser_download_url: "https://github.com/.../MyCommander_1.3.0_aarch64.dmg",
      size: 1234567,
    },
    {
      name: "MyCommander_1.3.0_x64-setup.exe",
      browser_download_url: "https://github.com/.../MyCommander_1.3.0_x64-setup.exe",
      size: 2345678,
    },
    {
      name: "MyCommander_1.3.0_amd64.AppImage",
      browser_download_url: "https://github.com/.../MyCommander_1.3.0_amd64.AppImage",
      size: 3456789,
    },
  ],
};

describe("githubReleaseClient", () => {
  it("selects correct installer per platform", () => {
    const macAsset = findPlatformAsset(mockRelease.assets, "macos");
    expect(macAsset?.name).toBe("MyCommander_1.3.0_aarch64.dmg");

    const winAsset = findPlatformAsset(mockRelease.assets, "windows");
    expect(winAsset?.name).toBe("MyCommander_1.3.0_x64-setup.exe");

    const linuxAsset = findPlatformAsset(mockRelease.assets, "linux");
    expect(linuxAsset?.name).toBe("MyCommander_1.3.0_amd64.AppImage");
  });

  it("parses release info and determines if it is newer", () => {
    const infoNewer = parseReleaseToUpdateInfo(mockRelease, "1.2.25", "macos");
    expect(infoNewer.version).toBe("1.3.0");
    expect(infoNewer.isNewer).toBe(true);
    expect(infoNewer.downloadUrl).toBe(
      "https://github.com/.../MyCommander_1.3.0_aarch64.dmg"
    );

    const infoOlder = parseReleaseToUpdateInfo(mockRelease, "2.0.0", "macos");
    expect(infoOlder.isNewer).toBe(false);
  });

  it("fetches latest release from GitHub API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRelease,
    } as Response);

    const updateInfo = await fetchLatestRelease(
      "1.2.25",
      "sungback/MyCommander",
      mockFetch as unknown as typeof fetch
    );

    expect(updateInfo.version).toBe("1.3.0");
    expect(updateInfo.isNewer).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/sungback/MyCommander/releases/latest",
      expect.any(Object)
    );
  });

  it("throws error if GitHub API returns non-200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    await expect(
      fetchLatestRelease("1.2.25", "sungback/MyCommander", mockFetch as unknown as typeof fetch)
    ).rejects.toThrow("GitHub API request failed with status 404");
  });
});
