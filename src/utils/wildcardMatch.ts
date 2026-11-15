/**
 * Convert a single wildcard pattern (e.g. "*.png", "photo_???.*") into a RegExp.
 * Supports:
 * - '*' matches 0 or more characters
 * - '?' matches exactly 1 character
 * - '*.*' matches all files (standard commander/DOS convention)
 * - Escapes all regular expression meta-characters properly
 */
export const wildcardToRegExp = (
  pattern: string,
  caseSensitive = false
): RegExp => {
  const trimmed = pattern.trim();
  if (trimmed === "*.*" || trimmed === "*") {
    return /^.*$/;
  }

  const escaped = trimmed
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  return new RegExp(`^${escaped}$`, caseSensitive ? "" : "i");
};

/**
 * Checks whether a filename matches one or more wildcard patterns
 * separated by ';' or ','.
 *
 * Example:
 *   matchesWildcard("test.jpg", "*.jpg; *.png") // true
 *   matchesWildcard("notes.txt", "*.doc") // false
 *   matchesWildcard("archive.tar.gz", "*.gz") // true
 */
export const matchesWildcard = (
  filename: string,
  patternString: string,
  caseSensitive = false
): boolean => {
  const patterns = patternString
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => {
    try {
      const regex = wildcardToRegExp(pattern, caseSensitive);
      return regex.test(filename);
    } catch {
      return false;
    }
  });
};
