export type MaybePromise<T> = T | Promise<T>;

export interface TextHighlightResult {
  highlightedHtml: string;
  language?: string;
}

export interface TextHighlighterModule {
  highlightText: (content: string, extension: string) => MaybePromise<TextHighlightResult | null>;
  highlightSource: (content: string, renderExt: string) => MaybePromise<string | null>;
  highlightSnippet: (
    content: string,
    language?: string
  ) => MaybePromise<TextHighlightResult | null>;
}

export interface MarkdownRendererModule {
  renderMarkdown: (content: string) => MaybePromise<string>;
}

export interface NotebookRendererModule {
  renderNotebook: (content: string) => MaybePromise<string>;
}

export interface PptxRendererModule {
  renderPptx: (filePath: string) => MaybePromise<string>;
}

export interface HwpxRendererModule {
  renderHwpx: (filePath: string) => MaybePromise<string>;
}

export interface XlsxRendererModule {
  renderXlsx: (filePath: string) => MaybePromise<string>;
}

export const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  r: "r",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  xml: "xml",
  svg: "xml",
  vue: "xml",
  json: "json",
  jsonc: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
};

export const MAX_NOTEBOOK_CELLS = 100;
export const MAX_OUTPUT_BYTES = 50 * 1024;
export const MAX_NOTEBOOK_BYTES = 5 * 1024 * 1024;
export const MARKDOWN_LINK_COLOR = {
  dark: "#58a6ff",
  light: "#0969da",
} as const;

export const getAppTheme = (): "dark" | "light" =>
  (document.documentElement.dataset.theme as "dark" | "light") ?? "dark";

export const joinSource = (src: string | string[]): string =>
  Array.isArray(src) ? src.join("") : src;

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const ansiToHtml = (value: string): string =>
  escapeHtml(value).replace(/\x1b\[[0-9;]*m/g, "");
