import { describe, expect, it } from "vitest";
import {
  getExtension,
  getFileName,
  HWPX_EXTENSIONS,
  IMAGE_EXTENSIONS,
  RENDER_EXTENSIONS,
  TEXT_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "./quickPreviewFileTypes";

describe("getExtension", () => {
  it("returns lowercase extension for uppercase suffix", () => {
    expect(getExtension("photo.PNG")).toBe("png");
  });

  it("returns extension from unix path", () => {
    expect(getExtension("/path/to/file.ts")).toBe("ts");
  });

  it("returns extension from windows path", () => {
    expect(getExtension("C:\\path\\file.tsx")).toBe("tsx");
  });

  it("returns '' for file with no extension", () => {
    expect(getExtension("noextension")).toBe("");
  });

  it("returns extension portion for dotfile (implementation treats as extension)", () => {
    expect(getExtension(".hidden")).toBe("hidden");
  });

  it("returns last extension for compound extension", () => {
    expect(getExtension("archive.tar.gz")).toBe("gz");
  });
});

describe("getFileName", () => {
  it("returns filename from unix path", () => {
    expect(getFileName("/home/user/document.pdf")).toBe("document.pdf");
  });

  it("returns filename from windows path", () => {
    expect(getFileName("C:\\Users\\file.txt")).toBe("file.txt");
  });

  it("returns the input itself when no path separator present", () => {
    expect(getFileName("justname")).toBe("justname");
  });
});

describe("extension sets", () => {
  it("IMAGE_EXTENSIONS includes png", () => {
    expect(IMAGE_EXTENSIONS.has("png")).toBe(true);
  });

  it("IMAGE_EXTENSIONS includes jpg", () => {
    expect(IMAGE_EXTENSIONS.has("jpg")).toBe(true);
  });

  it("VIDEO_EXTENSIONS includes mp4", () => {
    expect(VIDEO_EXTENSIONS.has("mp4")).toBe(true);
  });

  it("TEXT_EXTENSIONS includes ts", () => {
    expect(TEXT_EXTENSIONS.has("ts")).toBe(true);
  });

  it("TEXT_EXTENSIONS includes json", () => {
    expect(TEXT_EXTENSIONS.has("json")).toBe(true);
  });

  it("RENDER_EXTENSIONS includes md", () => {
    expect(RENDER_EXTENSIONS.has("md")).toBe(true);
  });

  it("HWPX_EXTENSIONS includes hwpx", () => {
    expect(HWPX_EXTENSIONS.has("hwpx")).toBe(true);
  });

  it("IMAGE_EXTENSIONS does not include pdf", () => {
    expect(IMAGE_EXTENSIONS.has("pdf")).toBe(false);
  });
});
