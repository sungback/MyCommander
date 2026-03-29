export function joinPath(base: string, child: string): string {
  // Simple check for Windows vs Unix paths
  const isWindows = base.includes("\\") || /^[A-Z]:/i.test(base);
  const sep = isWindows ? "\\" : "/";
  
  if (base.endsWith(sep)) {
    return base + child;
  }
  return base + sep + child;
}

export function getParentPath(path: string): string {
  const isWindows = path.includes("\\") || /^[A-Z]:/i.test(path);
  const sep = isWindows ? "\\" : "/";
  
  const parts = path.split(sep).filter(Boolean);
  if (parts.length <= 1) return path; // root
  parts.pop();
  
  let res = parts.join(sep);
  if (!isWindows && path.startsWith("/")) res = "/" + res;
  if (isWindows && res.length === 2 && res.endsWith(":")) res += "\\";
  
  return res;
}

export function isWindowsPath(path: string): boolean {
  return path.includes("\\") || /^[A-Z]:/i.test(path);
}

export function isAbsolutePath(path: string): boolean {
  return /^([A-Z]:[\\/]|\/|\\\\)/i.test(path);
}

export interface BreadcrumbPart {
  label: string;
  path: string;
}

export function getBreadcrumbParts(path: string): BreadcrumbPart[] {
  if (!path) {
    return [];
  }

  if (isWindowsPath(path)) {
    const normalized = path.replace(/\//g, "\\");
    const [drive = ""] = normalized.split("\\");
    const segments = normalized.split("\\").filter(Boolean).slice(1);
    const root = drive ? `${drive}\\` : normalized;
    const parts: BreadcrumbPart[] = [{ label: root, path: root }];

    let currentPath = root.replace(/\\$/, "");
    for (const segment of segments) {
      currentPath = `${currentPath}\\${segment}`;
      parts.push({ label: segment, path: currentPath });
    }

    return parts;
  }

  const segments = path.split("/").filter(Boolean);
  const parts: BreadcrumbPart[] = [{ label: "/", path: "/" }];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    parts.push({ label: segment, path: currentPath });
  }

  return parts;
}
