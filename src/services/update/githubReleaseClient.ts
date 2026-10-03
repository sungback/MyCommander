import { getPlatformType, PlatformType } from "../../utils/platform";
import { isNewerVersion } from "../../utils/semver";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface RawGithubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: ReleaseAsset[];
}

export interface UpdateInfo {
  version: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  releaseUrl: string;
  downloadUrl: string | null;
  assetName: string | null;
  selfUpdateUrl: string | null;
  selfUpdateAssetName: string | null;
  isNewer: boolean;
}

export const findSelfUpdateAsset = (
  assets: ReleaseAsset[],
  platform: PlatformType
): ReleaseAsset | null => {
  if (!assets || assets.length === 0) {
    return null;
  }

  if (platform === "macos") {
    // Prefer .app.tar.gz for direct in-place bundle replacement
    const tarGz = assets.find(
      (a) => a.name.endsWith(".app.tar.gz") || a.name.endsWith(".tar.gz")
    );
    if (tarGz) return tarGz;
    return null;
  }

  if (platform === "windows") {
    // Prefer -setup.exe or .exe
    const exe = assets.find((a) => a.name.endsWith("-setup.exe") || a.name.endsWith(".exe"));
    if (exe) return exe;
    return null;
  }

  if (platform === "linux") {
    // Prefer .AppImage
    const appImage = assets.find((a) => a.name.endsWith(".AppImage"));
    if (appImage) return appImage;
    return null;
  }

  return null;
};

export const findPlatformAsset = (
  assets: ReleaseAsset[],
  platform: PlatformType
): ReleaseAsset | null => {
  if (!assets || assets.length === 0) {
    return null;
  }

  if (platform === "macos") {
    // Prefer .dmg
    const dmg = assets.find((a) => a.name.endsWith(".dmg"));
    if (dmg) return dmg;
    // Fallback to .tar.gz
    return assets.find((a) => a.name.endsWith(".app.tar.gz")) ?? null;
  }

  if (platform === "windows") {
    // Prefer -setup.exe or .exe
    const exe = assets.find((a) => a.name.endsWith("-setup.exe") || a.name.endsWith(".exe"));
    if (exe) return exe;
    // Fallback to .msi
    return assets.find((a) => a.name.endsWith(".msi")) ?? null;
  }

  if (platform === "linux") {
    // Prefer .AppImage
    const appImage = assets.find((a) => a.name.endsWith(".AppImage"));
    if (appImage) return appImage;
    // Fallback to .deb
    const deb = assets.find((a) => a.name.endsWith(".deb"));
    if (deb) return deb;
    // Fallback to .rpm
    return assets.find((a) => a.name.endsWith(".rpm")) ?? null;
  }

  return null;
};

export const parseReleaseToUpdateInfo = (
  release: RawGithubRelease,
  currentVersion: string,
  platform: PlatformType = getPlatformType()
): UpdateInfo => {
  const version = release.tag_name.replace(/^[vV]/, "");
  const platformAsset = findPlatformAsset(release.assets || [], platform);
  const selfUpdateAsset = findSelfUpdateAsset(release.assets || [], platform);

  return {
    version,
    releaseName: release.name || release.tag_name,
    releaseNotes: release.body || "",
    publishedAt: release.published_at,
    releaseUrl: release.html_url,
    downloadUrl: platformAsset ? platformAsset.browser_download_url : release.html_url,
    assetName: platformAsset ? platformAsset.name : null,
    selfUpdateUrl: selfUpdateAsset ? selfUpdateAsset.browser_download_url : null,
    selfUpdateAssetName: selfUpdateAsset ? selfUpdateAsset.name : null,
    isNewer: isNewerVersion(currentVersion, version),
  };
};

export const fetchLatestRelease = async (
  currentVersion: string,
  repo: string = "sungback/MyCommander",
  fetchFn: typeof fetch = fetch
): Promise<UpdateInfo> => {
  const response = await fetchFn(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}: ${response.statusText}`);
  }

  const data: RawGithubRelease = await response.json();
  return parseReleaseToUpdateInfo(data, currentVersion);
};
