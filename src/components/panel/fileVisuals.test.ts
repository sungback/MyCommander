import { describe, expect, it } from "vitest";
import {
  Archive,
  ArrowUpToLine,
  File,
  FileText,
  Package,
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
    expect(closedFolder.slot).toBe("tc-folder-closed");
    expect(openFolder.slot).toBe("tc-folder-open");
    expect(closedFolder.iconClassName).toBe("theme-folder-icon");
    expect(openFolder.iconClassName).toBe("theme-folder-open-icon");
  });

  it("styles hidden folders and parent folders distinctly", () => {
    const hiddenFolder = resolveEntryVisual(
      createDirectory(".cache", { isHidden: true })
    );
    const parentFolder = resolveEntryVisual(createDirectory(".."));

    expect(hiddenFolder.group).toBe("folder-hidden");
    expect(hiddenFolder.slot).toBe("tc-folder-hidden");
    expect(hiddenFolder.overlayClassName).toBe("theme-tc-overlay-hidden");
    expect(hiddenFolder.nameClassName).toBe("theme-tc-hidden-name");
    expect(parentFolder.group).toBe("folder-parent");
    expect(parentFolder.slot).toBe("tc-folder-parent");
    expect(parentFolder.iconClassName).toBe("theme-folder-parent-icon");
    expect(parentFolder.icon).toBe(ArrowUpToLine);
  });

  it("styles mac app bundles as a distinct folder type", () => {
    const appBundle = resolveEntryVisual(createDirectory("MyCommander.app"));

    expect(appBundle.group).toBe("folder-app-bundle");
    expect(appBundle.slot).toBe("tc-folder-app");
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

  it("uses Total Commander-style standard slots for file groups", () => {
    expect(resolveEntryVisual(createFile("unknown.bin")).slot).toBe("tc-file-standard");
    expect(resolveEntryVisual(createFile("notes.md")).slot).toBe("tc-file-text");
    expect(resolveEntryVisual(createFile("main.ts")).slot).toBe("tc-file-text");
    expect(resolveEntryVisual(createFile("backup.zip")).slot).toBe("tc-file-archive");
    expect(resolveEntryVisual(createFile("installer.pkg")).slot).toBe("tc-file-program");
    expect(resolveEntryVisual(createFile("manual.pdf")).slot).toBe("tc-file-associated");
    expect(resolveEntryVisual(createFile("budget.xlsx")).slot).toBe("tc-file-associated");
  });

  it("adds short readable extension labels to file icons", () => {
    expect(resolveEntryVisual(createFile("manual.pdf")).extensionLabel).toBe("PDF");
    expect(resolveEntryVisual(createFile("budget.xlsx")).extensionLabel).toBe("XLS");
    expect(resolveEntryVisual(createFile("talk.pptx")).extensionLabel).toBe("PPT");
    expect(resolveEntryVisual(createFile("photo.jpeg")).extensionLabel).toBe("JPG");
    expect(resolveEntryVisual(createFile("main.ts")).extensionLabel).toBe("TS");
    expect(resolveEntryVisual(createFile("backup.tar.gz")).extensionLabel).toBe("TGZ");
    expect(resolveEntryVisual(createFile("unknown.bin")).extensionLabel).toBe("BIN");
  });

  it("uses extension-specific label colors for readable file scanning", () => {
    expect(resolveEntryVisual(createFile("manual.pdf")).extensionLabelClassName).toBe("theme-tc-ext-pdf");
    expect(resolveEntryVisual(createFile("budget.xlsx")).extensionLabelClassName).toBe("theme-tc-ext-xls");
    expect(resolveEntryVisual(createFile("main.ts")).extensionLabelClassName).toBe("theme-tc-ext-ts");
    expect(resolveEntryVisual(createFile("script.js")).extensionLabelClassName).toBe("theme-tc-ext-js");
    expect(resolveEntryVisual(createFile("photo.png")).extensionLabelClassName).toBe("theme-tc-ext-png");
    expect(resolveEntryVisual(createFile("photo.jpeg")).extensionLabelClassName).toBe("theme-tc-ext-jpg");
    expect(resolveEntryVisual(createFile("archive.zip")).extensionLabelClassName).toBe("theme-tc-ext-zip");
    expect(resolveEntryVisual(createFile("backup.tar.gz")).extensionLabelClassName).toBe("theme-tc-ext-tar");
    expect(resolveEntryVisual(createFile("movie.mp4")).extensionLabelClassName).toBe("theme-tc-ext-mp4");
    expect(resolveEntryVisual(createFile("song.mp3")).extensionLabelClassName).toBe("theme-tc-ext-mp3");
    expect(resolveEntryVisual(createFile("settings.yml")).extensionLabelClassName).toBe("theme-tc-ext-yaml");
    expect(resolveEntryVisual(createFile("installer.dmg")).extensionLabelClassName).toBe("theme-tc-ext-mac");
    expect(resolveEntryVisual(createFile("setup.exe")).extensionLabelClassName).toBe("theme-tc-ext-win");
  });

  it("uses the program slot for installer files", () => {
    const visual = resolveEntryVisual(createFile("installer.pkg"));

    expect(visual.icon).toBe(Package);
    expect(visual.iconWrapperClassName).toContain("theme-tc-slot-program-file");
  });

  it("uses local icon metadata without bundled SVG markup", () => {
    const visual = resolveEntryVisual(createFile("main.ts"));

    expect(visual.icon).toBe(FileText);
    expect("svgMarkup" in visual).toBe(false);
    expect("svgClassName" in visual).toBe(false);
  });

  it("maps richer file categories to compact associated-file markers", () => {
    expect(resolveEntryVisual(createFile("manual.pdf")).icon).toBe(File);
    expect(resolveEntryVisual(createFile("budget.xlsx")).iconWrapperClassName).toContain("theme-tc-type-spreadsheet");
    expect(resolveEntryVisual(createFile("talk.pptx")).iconWrapperClassName).toContain("theme-tc-type-presentation");
    expect(resolveEntryVisual(createFile("export.csv")).iconWrapperClassName).toContain("theme-tc-type-data");
    expect(resolveEntryVisual(createFile("photo.jpg")).iconWrapperClassName).toContain("theme-tc-type-image");
    expect(resolveEntryVisual(createFile("backup.zip")).icon).toBe(Archive);
    expect(resolveEntryVisual(createFile(".env")).icon).toBe(FileText);
  });

  it("uses compact associated-file markers for videos and audio", () => {
    const videoVisual = resolveEntryVisual(createFile("movie.mp4"));
    const audioVisual = resolveEntryVisual(createFile("song.mp3"));

    expect(videoVisual.slot).toBe("tc-file-associated");
    expect(audioVisual.slot).toBe("tc-file-associated");
    expect(videoVisual.iconWrapperClassName).toContain("theme-tc-type-media");
    expect(audioVisual.iconWrapperClassName).toContain("theme-tc-type-media");
  });

  it("uses a hidden file slot and overlay for hidden files", () => {
    const visual = resolveEntryVisual(createFile(".secret", { isHidden: true }));

    expect(visual.group).toBe("file-hidden");
    expect(visual.slot).toBe("tc-file-hidden");
    expect(visual.extensionLabel).toBe("SEC");
    expect(visual.overlayClassName).toBe("theme-tc-overlay-hidden");
    expect(visual.nameClassName).toBe("theme-tc-hidden-name");
  });

  it("treats readme-like files as documents even without an extension", () => {
    const visual = resolveEntryVisual(createFile("README"));

    expect(visual.group).toBe("file-document");
    expect(visual.slot).toBe("tc-file-text");
    expect(visual.extensionLabel).toBe("TXT");
    expect(visual.nameClassName).toBe("theme-tc-file-name");
  });
});
