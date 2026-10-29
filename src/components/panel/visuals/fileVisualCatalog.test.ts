import { describe, expect, it } from "vitest";
import {
  DOCUMENT_EXTENSIONS,
  PDF_EXTENSIONS,
  SPREADSHEET_EXTENSIONS,
  PRESENTATION_EXTENSIONS,
  DATA_EXTENSIONS,
  IMAGE_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  CODE_EXTENSIONS,
  CONFIG_EXTENSIONS,
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  APP_BUNDLE_EXTENSIONS,
  INSTALLER_EXTENSIONS,
  DOCUMENT_FILENAMES,
  ARCHIVE_SUFFIXES,
  EXTENSION_LABEL_OVERRIDES,
  FILENAME_LABEL_OVERRIDES,
  EXTENSION_LABEL_CLASS_OVERRIDES,
  FILENAME_LABEL_CLASS_OVERRIDES,
  ARCHIVE_LABEL_SUFFIXES,
  ARCHIVE_LABEL_SUFFIX_CLASSES,
} from "./fileVisualCatalog";
import { getNameStem, getFileExtension } from "./fileVisualNames";

describe("Extension Sets", () => {
  describe("DOCUMENT_EXTENSIONS", () => {
    it("contains core document extensions", () => {
      expect(DOCUMENT_EXTENSIONS.has("txt")).toBe(true);
      expect(DOCUMENT_EXTENSIONS.has("md")).toBe(true);
      expect(DOCUMENT_EXTENSIONS.has("docx")).toBe(true);
    });

    it("does not contain non-document extensions", () => {
      expect(DOCUMENT_EXTENSIONS.has("pdf")).toBe(false);
      expect(DOCUMENT_EXTENSIONS.has("jpg")).toBe(false);
      expect(DOCUMENT_EXTENSIONS.has("zip")).toBe(false);
    });
  });

  describe("PDF_EXTENSIONS", () => {
    it("contains pdf", () => {
      expect(PDF_EXTENSIONS.has("pdf")).toBe(true);
    });

    it("does not contain doc or txt", () => {
      expect(PDF_EXTENSIONS.has("doc")).toBe(false);
      expect(PDF_EXTENSIONS.has("txt")).toBe(false);
    });
  });

  describe("SPREADSHEET_EXTENSIONS", () => {
    it("contains spreadsheet extensions", () => {
      expect(SPREADSHEET_EXTENSIONS.has("xls")).toBe(true);
      expect(SPREADSHEET_EXTENSIONS.has("xlsx")).toBe(true);
      expect(SPREADSHEET_EXTENSIONS.has("numbers")).toBe(true);
    });

    it("does not contain csv (data category)", () => {
      expect(SPREADSHEET_EXTENSIONS.has("csv")).toBe(false);
    });
  });

  describe("PRESENTATION_EXTENSIONS", () => {
    it("contains presentation extensions", () => {
      expect(PRESENTATION_EXTENSIONS.has("ppt")).toBe(true);
      expect(PRESENTATION_EXTENSIONS.has("pptx")).toBe(true);
      expect(PRESENTATION_EXTENSIONS.has("key")).toBe(true);
    });

    it("does not contain doc or xls", () => {
      expect(PRESENTATION_EXTENSIONS.has("doc")).toBe(false);
      expect(PRESENTATION_EXTENSIONS.has("xls")).toBe(false);
    });
  });

  describe("DATA_EXTENSIONS", () => {
    it("contains data file extensions", () => {
      expect(DATA_EXTENSIONS.has("csv")).toBe(true);
      expect(DATA_EXTENSIONS.has("tsv")).toBe(true);
      expect(DATA_EXTENSIONS.has("sqlite")).toBe(true);
    });

    it("does not contain xls (spreadsheet category)", () => {
      expect(DATA_EXTENSIONS.has("xls")).toBe(false);
    });
  });

  describe("IMAGE_EXTENSIONS", () => {
    it("contains common image extensions", () => {
      expect(IMAGE_EXTENSIONS.has("png")).toBe(true);
      expect(IMAGE_EXTENSIONS.has("jpg")).toBe(true);
      expect(IMAGE_EXTENSIONS.has("svg")).toBe(true);
    });

    it("does not contain pdf or mp4", () => {
      expect(IMAGE_EXTENSIONS.has("pdf")).toBe(false);
      expect(IMAGE_EXTENSIONS.has("mp4")).toBe(false);
    });
  });

  describe("ARCHIVE_EXTENSIONS", () => {
    it("contains archive extensions", () => {
      expect(ARCHIVE_EXTENSIONS.has("zip")).toBe(true);
      expect(ARCHIVE_EXTENSIONS.has("tar")).toBe(true);
      expect(ARCHIVE_EXTENSIONS.has("7z")).toBe(true);
    });

    it("does not contain image or code extensions", () => {
      expect(ARCHIVE_EXTENSIONS.has("png")).toBe(false);
      expect(ARCHIVE_EXTENSIONS.has("js")).toBe(false);
    });
  });

  describe("CODE_EXTENSIONS", () => {
    it("contains common code extensions", () => {
      expect(CODE_EXTENSIONS.has("ts")).toBe(true);
      expect(CODE_EXTENSIONS.has("py")).toBe(true);
      expect(CODE_EXTENSIONS.has("rs")).toBe(true);
    });

    it("does not contain config-only extensions", () => {
      expect(CODE_EXTENSIONS.has("ini")).toBe(false);
      expect(CODE_EXTENSIONS.has("toml")).toBe(false);
    });
  });

  describe("CONFIG_EXTENSIONS", () => {
    it("contains config file extensions", () => {
      expect(CONFIG_EXTENSIONS.has("yaml")).toBe(true);
      expect(CONFIG_EXTENSIONS.has("toml")).toBe(true);
      expect(CONFIG_EXTENSIONS.has("ini")).toBe(true);
    });

    it("does not contain code extensions", () => {
      expect(CONFIG_EXTENSIONS.has("ts")).toBe(false);
      expect(CONFIG_EXTENSIONS.has("py")).toBe(false);
    });
  });

  describe("AUDIO_EXTENSIONS", () => {
    it("contains audio extensions", () => {
      expect(AUDIO_EXTENSIONS.has("mp3")).toBe(true);
      expect(AUDIO_EXTENSIONS.has("wav")).toBe(true);
      expect(AUDIO_EXTENSIONS.has("flac")).toBe(true);
    });

    it("does not contain video extensions", () => {
      expect(AUDIO_EXTENSIONS.has("mp4")).toBe(false);
      expect(AUDIO_EXTENSIONS.has("mkv")).toBe(false);
    });
  });

  describe("VIDEO_EXTENSIONS", () => {
    it("contains video extensions", () => {
      expect(VIDEO_EXTENSIONS.has("mp4")).toBe(true);
      expect(VIDEO_EXTENSIONS.has("mkv")).toBe(true);
      expect(VIDEO_EXTENSIONS.has("mov")).toBe(true);
    });

    it("does not contain audio extensions", () => {
      expect(VIDEO_EXTENSIONS.has("mp3")).toBe(false);
      expect(VIDEO_EXTENSIONS.has("flac")).toBe(false);
    });
  });

  describe("APP_BUNDLE_EXTENSIONS", () => {
    it("contains app", () => {
      expect(APP_BUNDLE_EXTENSIONS.has("app")).toBe(true);
    });
  });

  describe("INSTALLER_EXTENSIONS", () => {
    it("contains installer extensions for all platforms", () => {
      expect(INSTALLER_EXTENSIONS.has("dmg")).toBe(true);
      expect(INSTALLER_EXTENSIONS.has("exe")).toBe(true);
      expect(INSTALLER_EXTENSIONS.has("deb")).toBe(true);
    });

    it("does not contain app bundle extension", () => {
      expect(INSTALLER_EXTENSIONS.has("app")).toBe(false);
    });
  });

  describe("DOCUMENT_FILENAMES", () => {
    it("contains well-known document filenames", () => {
      expect(DOCUMENT_FILENAMES.has("readme")).toBe(true);
      expect(DOCUMENT_FILENAMES.has("license")).toBe(true);
      expect(DOCUMENT_FILENAMES.has("changelog")).toBe(true);
    });

    it("does not contain arbitrary filenames", () => {
      expect(DOCUMENT_FILENAMES.has("main")).toBe(false);
      expect(DOCUMENT_FILENAMES.has("index")).toBe(false);
    });
  });

  describe("ARCHIVE_SUFFIXES", () => {
    it("contains tar compound suffixes", () => {
      expect(ARCHIVE_SUFFIXES).toContain(".tar.gz");
      expect(ARCHIVE_SUFFIXES).toContain(".tar.bz2");
      expect(ARCHIVE_SUFFIXES).toContain(".tar.xz");
    });
  });
});

describe("EXTENSION_LABEL_OVERRIDES", () => {
  it("maps markdown to MD", () => {
    expect(EXTENSION_LABEL_OVERRIDES["markdown"]).toBe("MD");
  });

  it("maps docx to DOC", () => {
    expect(EXTENSION_LABEL_OVERRIDES["docx"]).toBe("DOC");
  });

  it("maps jpeg to JPG", () => {
    expect(EXTENSION_LABEL_OVERRIDES["jpeg"]).toBe("JPG");
  });

  it("maps xlsx to XLS", () => {
    expect(EXTENSION_LABEL_OVERRIDES["xlsx"]).toBe("XLS");
  });

  it("maps pptx to PPT", () => {
    expect(EXTENSION_LABEL_OVERRIDES["pptx"]).toBe("PPT");
  });

  it("maps yaml to YML", () => {
    expect(EXTENSION_LABEL_OVERRIDES["yaml"]).toBe("YML");
  });

  it("maps zsh to SH", () => {
    expect(EXTENSION_LABEL_OVERRIDES["zsh"]).toBe("SH");
  });

  it("maps bash to SH", () => {
    expect(EXTENSION_LABEL_OVERRIDES["bash"]).toBe("SH");
  });

  it("maps sqlite to DB", () => {
    expect(EXTENSION_LABEL_OVERRIDES["sqlite"]).toBe("DB");
  });

  it("maps gitignore to GIT", () => {
    expect(EXTENSION_LABEL_OVERRIDES["gitignore"]).toBe("GIT");
  });

  it("returns undefined for extensions without overrides", () => {
    expect(EXTENSION_LABEL_OVERRIDES["pdf"]).toBeUndefined();
    expect(EXTENSION_LABEL_OVERRIDES["ts"]).toBeUndefined();
    expect(EXTENSION_LABEL_OVERRIDES["mp4"]).toBeUndefined();
  });
});

describe("FILENAME_LABEL_OVERRIDES", () => {
  it("maps readme to TXT", () => {
    expect(FILENAME_LABEL_OVERRIDES["readme"]).toBe("TXT");
  });

  it("maps license to TXT", () => {
    expect(FILENAME_LABEL_OVERRIDES["license"]).toBe("TXT");
  });

  it("maps changelog to LOG", () => {
    expect(FILENAME_LABEL_OVERRIDES["changelog"]).toBe("LOG");
  });

  it("returns undefined for unknown filenames", () => {
    expect(FILENAME_LABEL_OVERRIDES["main"]).toBeUndefined();
    expect(FILENAME_LABEL_OVERRIDES["index"]).toBeUndefined();
  });
});

describe("EXTENSION_LABEL_CLASS_OVERRIDES", () => {
  it("all values start with theme-tc-ext-", () => {
    for (const [, cls] of Object.entries(EXTENSION_LABEL_CLASS_OVERRIDES)) {
      expect(cls).toMatch(/^theme-tc-ext-/);
    }
  });

  it("maps ts to theme-tc-ext-ts", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["ts"]).toBe("theme-tc-ext-ts");
  });

  it("maps tsx to theme-tc-ext-ts", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["tsx"]).toBe("theme-tc-ext-ts");
  });

  it("maps js and jsx to theme-tc-ext-js", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["js"]).toBe("theme-tc-ext-js");
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["jsx"]).toBe("theme-tc-ext-js");
  });

  it("maps pdf to theme-tc-ext-pdf", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["pdf"]).toBe("theme-tc-ext-pdf");
  });

  it("maps xls and xlsx to theme-tc-ext-xls", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["xls"]).toBe("theme-tc-ext-xls");
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["xlsx"]).toBe("theme-tc-ext-xls");
  });

  it("maps png to theme-tc-ext-png", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["png"]).toBe("theme-tc-ext-png");
  });

  it("maps jpg and jpeg to theme-tc-ext-jpg", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["jpg"]).toBe("theme-tc-ext-jpg");
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["jpeg"]).toBe("theme-tc-ext-jpg");
  });

  it("maps zip to theme-tc-ext-zip", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["zip"]).toBe("theme-tc-ext-zip");
  });

  it("maps dmg and pkg to theme-tc-ext-mac", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["dmg"]).toBe("theme-tc-ext-mac");
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["pkg"]).toBe("theme-tc-ext-mac");
  });

  it("maps exe and msi to theme-tc-ext-win", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["exe"]).toBe("theme-tc-ext-win");
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["msi"]).toBe("theme-tc-ext-win");
  });

  it("maps deb, rpm, apk to theme-tc-ext-linux", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["deb"]).toBe("theme-tc-ext-linux");
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["rpm"]).toBe("theme-tc-ext-linux");
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["apk"]).toBe("theme-tc-ext-linux");
  });

  it("maps yaml and yml to theme-tc-ext-yaml", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["yaml"]).toBe("theme-tc-ext-yaml");
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["yml"]).toBe("theme-tc-ext-yaml");
  });

  it("maps py to theme-tc-ext-py", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["py"]).toBe("theme-tc-ext-py");
  });

  it("maps rs to theme-tc-ext-rs", () => {
    expect(EXTENSION_LABEL_CLASS_OVERRIDES["rs"]).toBe("theme-tc-ext-rs");
  });
});

describe("FILENAME_LABEL_CLASS_OVERRIDES", () => {
  it("all values start with theme-tc-ext-", () => {
    for (const [, cls] of Object.entries(FILENAME_LABEL_CLASS_OVERRIDES)) {
      expect(cls).toMatch(/^theme-tc-ext-/);
    }
  });

  it("maps readme to theme-tc-ext-md", () => {
    expect(FILENAME_LABEL_CLASS_OVERRIDES["readme"]).toBe("theme-tc-ext-md");
  });

  it("maps license to theme-tc-ext-txt", () => {
    expect(FILENAME_LABEL_CLASS_OVERRIDES["license"]).toBe("theme-tc-ext-txt");
  });

  it("maps changelog to theme-tc-ext-txt", () => {
    expect(FILENAME_LABEL_CLASS_OVERRIDES["changelog"]).toBe("theme-tc-ext-txt");
  });
});

describe("ARCHIVE_LABEL_SUFFIXES", () => {
  it("maps .tar.gz to TGZ", () => {
    const entry = ARCHIVE_LABEL_SUFFIXES.find(([s]) => s === ".tar.gz");
    expect(entry?.[1]).toBe("TGZ");
  });

  it("maps .tar.bz2 to TBZ", () => {
    const entry = ARCHIVE_LABEL_SUFFIXES.find(([s]) => s === ".tar.bz2");
    expect(entry?.[1]).toBe("TBZ");
  });

  it("maps .tar.xz to TXZ", () => {
    const entry = ARCHIVE_LABEL_SUFFIXES.find(([s]) => s === ".tar.xz");
    expect(entry?.[1]).toBe("TXZ");
  });
});

describe("ARCHIVE_LABEL_SUFFIX_CLASSES", () => {
  it("all tar compound suffixes map to theme-tc-ext-tar", () => {
    for (const [, cls] of ARCHIVE_LABEL_SUFFIX_CLASSES) {
      expect(cls).toBe("theme-tc-ext-tar");
    }
  });
});

describe("getNameStem", () => {
  it("strips the extension from a normal filename", () => {
    expect(getNameStem("document.pdf")).toBe("document");
  });

  it("lowercases the stem", () => {
    expect(getNameStem("README.MD")).toBe("readme");
  });

  it("returns the full lowercase name when there is no extension", () => {
    expect(getNameStem("README")).toBe("readme");
  });

  it("handles filenames with multiple dots by stripping only the last", () => {
    expect(getNameStem("archive.tar.gz")).toBe("archive.tar");
  });

  it("treats a leading-dot-only name (dotfile with no suffix) as a stem", () => {
    expect(getNameStem(".gitignore")).toBe(".gitignore");
  });
});

describe("getFileExtension (fileVisualNames)", () => {
  it("extracts extension from a normal file", () => {
    expect(getFileExtension("photo.jpg")).toBe("jpg");
  });

  it("lowercases the extension", () => {
    expect(getFileExtension("Photo.JPG")).toBe("jpg");
  });

  it("returns null for a file with no extension", () => {
    expect(getFileExtension("README")).toBeNull();
  });

  it("returns null for a trailing-dot filename", () => {
    expect(getFileExtension("file.")).toBeNull();
  });

  it("returns the last extension for compound filenames", () => {
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
  });

  it("treats dotfiles like .env as having an extension", () => {
    expect(getFileExtension(".env")).toBe("env");
  });
});
