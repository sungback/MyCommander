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

export interface PreviewTheme {
  isDark: boolean;
  background: string;
  foreground: string;
  border: string;
  codeBackground: string;
  blockquote: string;
  link: string;
  muted: string;
  divider: string;
  outputBackground: string;
  alternateBackground: string;
  badgeBlue: string;
  badgeBlueBackground: string;
  badgeGreen: string;
  badgeGreenBackground: string;
  errorBackground: string;
  errorForeground: string;
}

export const getPreviewTheme = (): PreviewTheme => {
  const isDark = getAppTheme() === "dark";

  return {
    isDark,
    background: isDark ? "#0d1117" : "#ffffff",
    foreground: isDark ? "#e6edf3" : "#1f2328",
    border: isDark ? "#30363d" : "#d1d9e0",
    codeBackground: isDark ? "#161b22" : "#f6f8fa",
    blockquote: isDark ? "#8b949e" : "#636c76",
    link: isDark ? MARKDOWN_LINK_COLOR.dark : MARKDOWN_LINK_COLOR.light,
    muted: isDark ? "#6e7681" : "#9ca3af",
    divider: isDark ? "#21262d" : "#e1e4e8",
    outputBackground: isDark ? "#0d1117" : "#f8f9fa",
    alternateBackground: isDark ? "#0d1117" : "#f8fafc",
    badgeBlue: isDark ? "#58a6ff" : "#0969da",
    badgeBlueBackground: isDark ? "rgba(88,166,255,0.12)" : "rgba(9,105,218,0.1)",
    badgeGreen: isDark ? "#3fb950" : "#1a7f37",
    badgeGreenBackground: isDark ? "rgba(63,185,80,0.12)" : "rgba(26,127,55,0.1)",
    errorBackground: isDark ? "#1f0a0a" : "#fff5f5",
    errorForeground: isDark ? "#ff7b72" : "#d73a49",
  };
};

export const buildPreviewHtmlDocument = ({
  styles,
  body,
}: {
  styles: string;
  body: string;
}): string => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
${styles}
</style>
</head>
<body>${body}</body>
</html>`;

export const joinSource = (src: string | string[]): string =>
  Array.isArray(src) ? src.join("") : src;

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const ansiToHtml = (value: string): string =>
  escapeHtml(value).replace(/\x1b\[[0-9;]*m/g, "");
