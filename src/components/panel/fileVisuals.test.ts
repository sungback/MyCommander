import { describe, expect, it } from "vitest";
import {
  Archive,
  ArrowUpToLine,
  AudioLines,
  Database,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileType2,
  FileVideo2,
  Image,
  PackageOpen,
  Presentation,
  SlidersHorizontal,
} from "lucide-react";
import { resolveEntryVisual, getFileExtension } from "./fileVisuals";
import { FileEntry } from "../../types/file";

const createFile = (name: string, overrides: Partial<FileEntry> = {}): FileEntry => ({
  name,
  path: `/tmp/${name}`,
  kind: "file",
  ...overrides,
});

const createDirectory = (
  name: string,
  overrides: Partial<FileEntry> = {}
): FileEntry => ({
  name,
  path: `/tmp/${name}`,
  kind: "directory",
  ...overrides,
});

describe("getFileExtension", () => {
  it("extracts a normal extension", () => {
    expect(getFileExtension("photo.jpg")).toBe("jpg");
  });

  it("extracts a dotfile suffix when present", () => {
    expect(getFileExtension(".env")).toBe("env");
  });

  it("returns null for files without a usable extension", () => {
    expect(getFileExtension("README")).toBeNull();
  });
});

describe("resolveEntryVisual", () => {
  it("styles standard folders differently from open folders", () => {
    const closedFolder = resolveEntryVisual(createDirectory("Projects"));
    const openFolder = resolveEntryVisual(createDirectory("Projects"), { isExpanded: true });

    expect(closedFolder.group).toBe("folder");
    expect(openFolder.group).toBe("folder-open");
    expect(closedFolder.iconClassName).toBe("theme-folder-icon");
    expect(openFolder.iconClassName).toBe("theme-folder-open-icon");
  });

  it("styles hidden folders and parent folders distinctly", () => {
    const hiddenFolder = resolveEntryVisual(
      createDirectory(".cache", { isHidden: true })
    );
    const parentFolder = resolveEntryVisual(createDirectory(".."));

    expect(hiddenFolder.group).toBe("folder-hidden");
    expect(hiddenFolder.nameClassName).toBe("theme-folder-hidden-name");
    expect(parentFolder.group).toBe("folder-parent");
    expect(parentFolder.iconClassName).toBe("theme-folder-parent-icon");
    expect(parentFolder.icon).toBe(ArrowUpToLine);
  });

  it("styles mac app bundles as a distinct folder type", () => {
    const appBundle = resolveEntryVisual(createDirectory("MyCommander.app"));

    expect(appBundle.group).toBe("folder-app-bundle");
    expect(appBundle.iconClassName).toBe("theme-folder-app-bundle-icon");
  });

  it("classifies common file categories with distinct visual groups", () => {
    expect(resolveEntryVisual(createFile("notes.md")).group).toBe("file-document");
    expect(resolveEntryVisual(createFile("manual.pdf")).group).toBe("file-pdf");
    expect(resolveEntryVisual(createFile("budget.xlsx")).group).toBe("file-spreadsheet");
    expect(resolveEntryVisual(createFile("talk.pptx")).group).toBe("file-presentation");
    expect(resolveEntryVisual(createFile("export.csv")).group).toBe("file-data");
    expect(resolveEntryVisual(createFile("photo.jpg")).group).toBe("file-image");
    expect(resolveEntryVisual(createFile("backup.tar.gz")).group).toBe("file-archive");
    expect(resolveEntryVisual(createFile("main.ts")).group).toBe("file-code");
    expect(resolveEntryVisual(createFile(".env")).group).toBe("file-config");
    expect(resolveEntryVisual(createFile("song.mp3")).group).toBe("file-audio");
    expect(resolveEntryVisual(createFile("movie.mp4")).group).toBe("file-video");
    expect(resolveEntryVisual(createFile("installer.msi")).group).toBe("file-installer");
    expect(resolveEntryVisual(createFile("Installer.dmg")).group).toBe("file-installer");
    expect(resolveEntryVisual(createFile("Portable.app")).group).toBe("file-app");
    expect(resolveEntryVisual(createFile("unknown.bin")).group).toBe("file-default");
  });

  it("adds a download badge to installer files", () => {
    const visual = resolveEntryVisual(createFile("installer.pkg"));

    expect(visual.icon).toBe(PackageOpen);
    expect(visual.badgeIcon).toBe(Download);
    expect(visual.badgeClassName).toBe("theme-file-installer-badge");
  });

  it("uses local icon metadata without bundled SVG markup", () => {
    const visual = resolveEntryVisual(createFile("main.ts"));

    expect(visual.icon).toBe(FileCode2);
    expect("svgMarkup" in visual).toBe(false);
    expect("svgClassName" in visual).toBe(false);
  });

  it("uses distinct silhouettes for richer file categories", () => {
    expect(resolveEntryVisual(createFile("manual.pdf")).icon).toBe(FileType2);
    expect(resolveEntryVisual(createFile("budget.xlsx")).icon).toBe(FileSpreadsheet);
    expect(resolveEntryVisual(createFile("talk.pptx")).icon).toBe(Presentation);
    expect(resolveEntryVisual(createFile("export.csv")).icon).toBe(Database);
    expect(resolveEntryVisual(createFile("photo.jpg")).icon).toBe(Image);
    expect(resolveEntryVisual(createFile("backup.zip")).icon).toBe(Archive);
    expect(resolveEntryVisual(createFile(".env")).icon).toBe(SlidersHorizontal);
  });

  it("uses a video icon for videos and an audio icon for audio", () => {
    const videoVisual = resolveEntryVisual(createFile("movie.mp4"));
    const audioVisual = resolveEntryVisual(createFile("song.mp3"));

    expect(videoVisual.icon).toBe(FileVideo2);
    expect(audioVisual.icon).toBe(AudioLines);
  });

  it("treats readme-like files as documents even without an extension", () => {
    const visual = resolveEntryVisual(createFile("README"));

    expect(visual.group).toBe("file-document");
    expect(visual.nameClassName).toBe("theme-file-document-name");
  });
});
