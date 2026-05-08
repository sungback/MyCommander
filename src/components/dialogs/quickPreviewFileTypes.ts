export const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "tiff",
  "avif",
]);

export const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "mkv",
  "avi",
  "m4v",
]);

export const RENDER_EXTENSIONS = new Set(["md", "markdown", "html", "htm"]);
export const NOTEBOOK_EXTENSIONS = new Set(["ipynb"]);
export const PDF_EXTENSIONS = new Set(["pdf"]);
export const PPTX_EXTENSIONS = new Set(["pptx"]);
export const HWPX_EXTENSIONS = new Set(["hwpx"]);
export const XLSX_EXTENSIONS = new Set(["xlsx"]);
export const DOCX_EXTENSIONS = new Set(["docx"]);

export const TEXT_EXTENSIONS = new Set([
  "txt",
  "json",
  "jsonc",
  "ts",
  "tsx",
  "js",
  "jsx",
  "css",
  "scss",
  "sass",
  "less",
  "xml",
  "yaml",
  "yml",
  "toml",
  "rs",
  "py",
  "r",
  "go",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "sh",
  "bash",
  "zsh",
  "fish",
  "env",
  "gitignore",
  "gitattributes",
  "editorconfig",
  "lock",
  "log",
  "csv",
  "sql",
  "graphql",
  "gql",
  "vue",
  "svelte",
  "astro",
  "ini",
  "cfg",
  "conf",
  "config",
  "makefile",
]);

export const getExtension = (path: string): string => {
  const fileName = path.split(/[\\/]/).pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) {
    return "";
  }

  return fileName.slice(dotIndex + 1).toLowerCase();
};

export const getFileName = (path: string): string =>
  path.split(/[\\/]/).pop() ?? path;
