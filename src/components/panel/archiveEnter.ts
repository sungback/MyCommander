import { FileEntry } from "../../types/file";

type PanelId = "left" | "right";

interface ArchiveFs {
  extractZip: (path: string) => Promise<string>;
  openFile: (path: string) => Promise<void>;
}

interface EnterArchiveEntryOptions {
  entry: FileEntry;
  fs: ArchiveFs;
  panelId: PanelId;
  setPath: (panel: PanelId, path: string) => void;
}

export const isZipArchiveEntry = (entry: Pick<FileEntry, "name">) =>
  typeof entry.name === "string" && entry.name.toLowerCase().endsWith(".zip");

export const isDmgEntry = (entry: Pick<FileEntry, "name">) =>
  typeof entry.name === "string" && entry.name.toLowerCase().endsWith(".dmg");

export const isArchiveEntry = (entry: Pick<FileEntry, "name">) =>
  isZipArchiveEntry(entry) || isDmgEntry(entry);

export const enterArchiveEntry = async ({
  entry,
  fs,
  panelId,
  setPath,
}: EnterArchiveEntryOptions) => {
  if (isZipArchiveEntry(entry)) {
    const extractedPath = await fs.extractZip(entry.path);
    setPath(panelId, extractedPath);
    return true;
  }

  if (isDmgEntry(entry)) {
    await fs.openFile(entry.path);
    return true;
  }

  return false;
};
