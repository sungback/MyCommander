/**
 * Utility for parsing and comparing semantic versions (e.g. "v1.2.25", "1.2.26").
 */

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export const parseSemver = (versionStr: string): ParsedSemver | null => {
  if (!versionStr || typeof versionStr !== "string") {
    return null;
  }

  // Strip leading 'v' or 'V' and trim whitespace
  const clean = versionStr.trim().replace(/^[vV]/, "");
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || undefined,
  };
};

/**
 * Returns:
 *  1 if a > b
 * -1 if a < b
 *  0 if a == b
 */
export const compareSemver = (a: string, b: string): number => {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);

  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return -1;
  if (!parsedB) return 1;

  if (parsedA.major !== parsedB.major) {
    return parsedA.major > parsedB.major ? 1 : -1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor > parsedB.minor ? 1 : -1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch > parsedB.patch ? 1 : -1;
  }

  // Pre-release versions have lower precedence than normal releases
  if (parsedA.prerelease && !parsedB.prerelease) return -1;
  if (!parsedA.prerelease && parsedB.prerelease) return 1;
  if (parsedA.prerelease && parsedB.prerelease) {
    return parsedA.prerelease.localeCompare(parsedB.prerelease);
  }

  return 0;
};

/**
 * Returns true if remoteVersion is strictly greater than currentVersion.
 */
export const isNewerVersion = (
  currentVersion: string,
  remoteVersion: string
): boolean => {
  return compareSemver(remoteVersion, currentVersion) > 0;
};
