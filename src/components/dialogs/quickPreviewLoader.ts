import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export type PreviewType =
  | "image"
  | "video"
  | "pdf"
  | "text"
  | "rendered"
  | "unsupported"
  | "loading"
  | "error";

export interface PreviewState {
  type: PreviewType;
  content?: string;
  highlightedHtml?: string;
  renderedHtml?: string;
  language?: string;
  src?: string;
  error?: string;
  renderExt?: string;
}

interface NbOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface NbCell {
  cell_type: "markdown" | "code" | "raw";
  source: string | string[];
  outputs?: NbOutput[];
  execution_count?: number | null;
}

interface NbFormat {
  cells: NbCell[];
  metadata?: { kernelspec?: { language?: string } };
}

type InvokeImpl = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type MaybePromise<T> = T | Promise<T>;

interface TextHighlightResult {
  highlightedHtml: string;
  language?: string;
}

interface TextHighlighterModule {
  highlightText: (content: string, extension: string) => MaybePromise<TextHighlightResult | null>;
  highlightSource: (content: string, renderExt: string) => MaybePromise<string | null>;
  highlightSnippet: (content: string, language?: string) => MaybePromise<TextHighlightResult | null>;
}

interface MarkdownRendererModule {
  renderMarkdown: (content: string) => MaybePromise<string>;
}

interface NotebookRendererModule {
  renderNotebook: (content: string) => MaybePromise<string>;
}

interface PptxRendererModule {
  renderPptx: (filePath: string) => MaybePromise<string>;
}

interface HwpxRendererModule {
  renderHwpx: (filePath: string) => MaybePromise<string>;
}

interface XlsxRendererModule {
  renderXlsx: (filePath: string) => MaybePromise<string>;
}

interface DocxRendererModule {
  renderDocx: (filePath: string) => MaybePromise<string>;
}

export interface QuickPreviewLoaderOptions {
  convertFileSrcImpl?: (path: string) => string;
  invokeImpl?: InvokeImpl;
  fetchImpl?: typeof fetch;
  loadTextHighlighter?: () => Promise<TextHighlighterModule>;
  loadMarkdownRenderer?: () => Promise<MarkdownRendererModule>;
  loadNotebookRenderer?: () => Promise<NotebookRendererModule>;
  loadPptxRenderer?: () => Promise<PptxRendererModule>;
  loadHwpxRenderer?: () => Promise<HwpxRendererModule>;
  loadXlsxRenderer?: () => Promise<XlsxRendererModule>;
  loadDocxRenderer?: () => Promise<DocxRendererModule>;
}

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tiff", "avif",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4", "webm", "mov", "mkv", "avi", "m4v",
]);

const RENDER_EXTENSIONS = new Set(["md", "markdown", "html", "htm"]);
const NOTEBOOK_EXTENSIONS = new Set(["ipynb"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const PPTX_EXTENSIONS = new Set(["pptx"]);
const HWPX_EXTENSIONS = new Set(["hwpx"]);
const XLSX_EXTENSIONS = new Set(["xlsx", "xls"]);
const DOCX_EXTENSIONS = new Set(["docx"]);

const TEXT_EXTENSIONS = new Set([
  "txt", "json", "jsonc", "ts", "tsx", "js", "jsx",
  "css", "scss", "sass", "less", "xml", "yaml", "yml", "toml",
  "rs", "py", "r", "go", "java", "c", "cpp", "h", "hpp", "sh", "bash", "zsh",
  "fish", "env", "gitignore", "gitattributes", "editorconfig", "lock",
  "log", "csv", "sql", "graphql", "gql", "vue", "svelte", "astro", "ini",
  "cfg", "conf", "config", "makefile",
]);

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  py: "python",
  r: "r",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c", h: "c",
  cpp: "cpp", hpp: "cpp", cc: "cpp",
  sh: "bash", bash: "bash", zsh: "bash", fish: "bash",
  css: "css", scss: "css", sass: "css", less: "css",
  xml: "xml", svg: "xml", vue: "xml",
  json: "json", jsonc: "json",
  yaml: "yaml", yml: "yaml",
  toml: "ini", ini: "ini", cfg: "ini", conf: "ini",
  sql: "sql",
  graphql: "graphql", gql: "graphql",
};

const MAX_NOTEBOOK_CELLS = 100;
const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_NOTEBOOK_BYTES = 5 * 1024 * 1024;
const MARKDOWN_LINK_COLOR = {
  dark: "#58a6ff",
  light: "#0969da",
} as const;

let textHighlighterPromise: Promise<TextHighlighterModule> | null = null;

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

const getAppTheme = (): "dark" | "light" =>
  (document.documentElement.dataset.theme as "dark" | "light") ?? "dark";

const joinSource = (src: string | string[]): string =>
  Array.isArray(src) ? src.join("") : src;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const ansiToHtml = (value: string): string =>
  escapeHtml(value).replace(/\x1b\[[0-9;]*m/g, "");

const buildMarkdownHtml = (body: string): string => {
  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const codeBg = isDark ? "#161b22" : "#f6f8fa";
  const blockquoteColor = isDark ? "#8b949e" : "#636c76";
  const linkColor = isDark ? MARKDOWN_LINK_COLOR.dark : MARKDOWN_LINK_COLOR.light;
  const trEvenBg = isDark ? "#161b22" : "#f6f8fa";
  const thBg = isDark ? "#161b22" : "#f6f8fa";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.7; padding: 24px 32px;
    color: ${fg}; background: ${bg}; margin: 0;
  }
  h1,h2,h3,h4,h5,h6 { font-weight: 600; margin: 1.2em 0 0.5em; color: ${fg}; }
  h1 { font-size: 2em; border-bottom: 1px solid ${borderColor}; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid ${borderColor}; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  p { margin: 0.8em 0; }
  a { color: ${linkColor}; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    background: ${codeBg}; padding: 0.2em 0.4em;
    border-radius: 4px; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 85%;
  }
  pre {
    background: ${codeBg}; padding: 16px; border-radius: 6px;
    overflow-x: auto; margin: 1em 0;
  }
  pre code { background: none; padding: 0; font-size: 100%; }
  blockquote {
    border-left: 4px solid ${borderColor}; padding: 0 1em;
    color: ${blockquoteColor}; margin: 0 0 1em;
  }
  ul, ol { padding-left: 2em; margin: 0.5em 0; }
  li { margin: 0.25em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid ${borderColor}; padding: 6px 13px; text-align: left; }
  th { background: ${thBg}; font-weight: 600; }
  tr:nth-child(even) td { background: ${trEvenBg}; }
  img { max-width: 100%; border-radius: 4px; }
  hr { border: none; border-top: 1px solid ${borderColor}; margin: 1.5em 0; }
  strong { font-weight: 600; }
  del { color: ${blockquoteColor}; }
  input[type="checkbox"] { margin-right: 0.4em; }
</style>
</head>
<body>${body}</body>
</html>`;
};

const fetchPreviewText = async (
  path: string,
  fetchImpl: typeof fetch,
  convertFileSrcImpl: (path: string) => string
) => {
  const url = convertFileSrcImpl(path);
  const response = await fetchImpl(url);
  const contentLength = response.headers.get("content-length");

  if (contentLength && Number.parseInt(contentLength, 10) > MAX_NOTEBOOK_BYTES) {
    throw new Error("파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다.");
  }

  const content = await response.text();
  if (content.length > MAX_NOTEBOOK_BYTES) {
    throw new Error("파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다.");
  }

  return content;
};

const buildPptxHtml = async (
  filePath: string,
  convertFileSrcImpl: (path: string) => string
): Promise<string> => {
  const [{ default: JSZip }] = await Promise.all([
    import("jszip"),
  ]);

  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const cardBg = isDark ? "#161b22" : "#f6f8fa";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const badgeColor = isDark ? "#58a6ff" : "#0969da";
  const badgeBg = isDark ? "rgba(88,166,255,0.12)" : "rgba(9,105,218,0.1)";
  const emptyColor = isDark ? "#6e7681" : "#9ca3af";

  const url = convertFileSrcImpl(filePath);
  const buffer = await fetch(url).then((response) => response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = Number.parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  const slidesHtml = await Promise.all(
    slideEntries.map(async (name, index) => {
      const xmlStr = await zip.files[name].async("string");
      const parser = new DOMParser();
      const document = parser.parseFromString(xmlStr, "text/xml");
      const namespace = "http://schemas.openxmlformats.org/drawingml/2006/main";
      const nodes = document.getElementsByTagNameNS(namespace, "t");
      const texts: string[] = [];

      for (let i = 0; i < nodes.length; i += 1) {
        const text = nodes[i].textContent?.trim();
        if (text) {
          texts.push(text);
        }
      }

      const content = texts.length > 0
        ? texts.map((text) => `<div class="slide-line">${escapeHtml(text)}</div>`).join("")
        : `<div class="slide-empty">( 텍스트 없음 )</div>`;

      return `<div class="slide-card">
  <div class="slide-header">
    <span class="slide-badge">슬라이드 ${index + 1}</span>
  </div>
  <div class="slide-body">${content}</div>
</div>`;
    })
  );

  if (slidesHtml.length === 0) {
    return `<html><body style="color:${emptyColor};font-family:sans-serif;padding:32px;background:${bg}">슬라이드를 찾을 수 없습니다.</body></html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.6; color: ${fg}; background: ${bg}; margin: 0; padding: 20px 24px; }
  .slide-card { background: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
  .slide-header { padding: 8px 14px; border-bottom: 1px solid ${borderColor}; }
  .slide-badge { font-size: 11px; font-weight: 600; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 8px; border-radius: 10px; }
  .slide-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
  .slide-line { font-size: 13px; color: ${fg}; word-break: break-word; }
  .slide-empty { font-size: 12px; color: ${emptyColor}; font-style: italic; }
</style>
</head>
<body>${slidesHtml.join("\n")}</body>
</html>`;
};

const buildHwpxHtml = async (
  filePath: string,
  convertFileSrcImpl: (path: string) => string
): Promise<string> => {
  const [{ default: JSZip }] = await Promise.all([
    import("jszip"),
  ]);

  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const cardBg = isDark ? "#161b22" : "#f6f8fa";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const badgeColor = isDark ? "#58a6ff" : "#0969da";
  const badgeBg = isDark ? "rgba(88,166,255,0.12)" : "rgba(9,105,218,0.1)";
  const emptyColor = isDark ? "#6e7681" : "#9ca3af";
  const dividerColor = isDark ? "#21262d" : "#e1e4e8";

  const url = convertFileSrcImpl(filePath);
  const buffer = await fetch(url).then((response) => response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  const sectionEntries = Object.keys(zip.files)
    .filter((name) => /^[Cc]ontents\/[Ss]ection\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = Number.parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  if (sectionEntries.length === 0) {
    return `<html><body style="color:${emptyColor};font-family:sans-serif;padding:32px;background:${bg}">섹션 파일을 찾을 수 없습니다.</body></html>`;
  }

  const sectionsHtml = await Promise.all(
    sectionEntries.map(async (name, index) => {
      const xmlStr = await zip.files[name].async("string");
      const parser = new DOMParser();
      const document = parser.parseFromString(xmlStr, "text/xml");
      const paragraphs: string[] = [];
      const paragraphNodes = document.getElementsByTagName("hp:p");

      if (paragraphNodes.length > 0) {
        for (let i = 0; i < paragraphNodes.length; i += 1) {
          const textNodes = paragraphNodes[i].getElementsByTagName("hp:t");
          const line = Array.from(textNodes)
            .map((node) => node.textContent ?? "")
            .join("");

          if (line.trim()) {
            paragraphs.push(line.trim());
          }
        }
      } else {
        const textNodes = document.getElementsByTagName("hp:t");
        for (let i = 0; i < textNodes.length; i += 1) {
          const text = textNodes[i].textContent?.trim();
          if (text) {
            paragraphs.push(text);
          }
        }
      }

      const content = paragraphs.length > 0
        ? paragraphs.map((paragraph) => `<p class="hwp-para">${escapeHtml(paragraph)}</p>`).join("")
        : `<p class="hwp-empty">( 텍스트 없음 )</p>`;

      return `<div class="section-card">
  <div class="section-header">
    <span class="section-badge">섹션 ${index + 1}</span>
  </div>
  <div class="section-body">${content}</div>
</div>`;
    })
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    font-size: 14px; line-height: 1.7; color: ${fg}; background: ${bg}; margin: 0; padding: 20px 24px; }
  .section-card { background: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
  .section-header { padding: 8px 14px; border-bottom: 1px solid ${dividerColor}; }
  .section-badge { font-size: 11px; font-weight: 600; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 8px; border-radius: 10px; }
  .section-body { padding: 12px 16px; }
  .hwp-para { margin: 0 0 6px; font-size: 13px; color: ${fg}; word-break: break-word; }
  .hwp-para:last-child { margin-bottom: 0; }
  .hwp-empty { font-size: 12px; color: ${emptyColor}; font-style: italic; margin: 0; }
</style>
</head>
<body>${sectionsHtml.join("\n")}</body>
</html>`;
};

const buildXlsxHtml = async (
  filePath: string,
  convertFileSrcImpl: (path: string) => string
): Promise<string> => {
  const XLSX = await import("xlsx");

  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const thBg = isDark ? "#161b22" : "#f6f8fa";
  const trEvenBg = isDark ? "#0d1117" : "#f8fafc";
  const badgeColor = isDark ? "#3fb950" : "#1a7f37";
  const badgeBg = isDark ? "rgba(63,185,80,0.12)" : "rgba(26,127,55,0.1)";
  const mutedColor = isDark ? "#6e7681" : "#9ca3af";
  const sheetHeaderBg = isDark ? "#161b22" : "#f6f8fa";
  const sheetHeaderBorder = isDark ? "#21262d" : "#d1d9e0";
  const maxRows = 500;

  const url = convertFileSrcImpl(filePath);
  const buffer = await fetch(url).then((response) => response.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetsHtml = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });
    const truncated = rows.length > maxRows;
    const displayRows = rows.slice(0, maxRows) as unknown[][];

    if (displayRows.length === 0) {
      return `<div class="sheet-block">
  <div class="sheet-header"><span class="sheet-badge">${escapeHtml(sheetName)}</span></div>
  <div class="sheet-empty">( 데이터 없음 )</div>
</div>`;
    }

    const maxCols = displayRows.reduce((max, row) => Math.max(max, row.length), 0);
    const headerRow = displayRows[0];
    const dataRows = displayRows.slice(1);

    const theadHtml = `<thead><tr>${headerRow
      .map((cell) => `<th>${escapeHtml(String(cell ?? ""))}</th>`)
      .join("")}</tr></thead>`;

    const tbodyHtml = `<tbody>${dataRows
      .map((row, rowIndex) => `<tr class="${rowIndex % 2 === 1 ? "even" : ""}">${Array.from(
        { length: maxCols },
        (_, columnIndex) => `<td>${escapeHtml(String((row as unknown[])[columnIndex] ?? ""))}</td>`
      ).join("")}</tr>`)
      .join("")}</tbody>`;

    const note = truncated
      ? `<div class="truncate-note">처음 ${maxRows}행만 표시됩니다 (전체 ${rows.length}행)</div>`
      : "";

    return `<div class="sheet-block">
  <div class="sheet-header"><span class="sheet-badge">${escapeHtml(sheetName)}</span></div>
  ${note}
  <div class="table-wrap">
    <table>${theadHtml}${tbodyHtml}</table>
  </div>
</div>`;
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 13px; color: ${fg}; background: ${bg}; margin: 0; padding: 16px 20px; }
  .sheet-block { margin-bottom: 20px; border: 1px solid ${borderColor}; border-radius: 8px; overflow: hidden; }
  .sheet-header { background: ${sheetHeaderBg}; padding: 8px 14px; border-bottom: 1px solid ${sheetHeaderBorder}; }
  .sheet-badge { font-size: 11px; font-weight: 600; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 8px; border-radius: 10px; }
  .sheet-empty { padding: 14px 16px; font-size: 12px; color: ${mutedColor}; font-style: italic; }
  .truncate-note { padding: 6px 14px; font-size: 11px; color: ${mutedColor}; background: ${sheetHeaderBg}; border-bottom: 1px solid ${sheetHeaderBorder}; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; min-width: max-content; }
  th { background: ${thBg}; font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid ${borderColor}; white-space: nowrap; position: sticky; top: 0; }
  td { padding: 5px 10px; border: 1px solid ${borderColor}; white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
  tr.even td { background: ${trEvenBg}; }
</style>
</head>
<body>${sheetsHtml.join("\n")}</body>
</html>`;
};

const buildNotebookHtml = async (
  jsonContent: string,
  loadTextHighlighter: () => Promise<TextHighlighterModule>
): Promise<string> => {
  const [{ marked }, highlighter] = await Promise.all([
    import("marked"),
    loadTextHighlighter(),
  ]);

  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const codeBg = isDark ? "#161b22" : "#f6f8fa";
  const outputBg = isDark ? "#0d1117" : "#f8f9fa";
  const cellBorderColor = isDark ? "#21262d" : "#e1e4e8";
  const gutterColor = isDark ? "#6e7681" : "#8c959f";
  const errorBg = isDark ? "#1f0a0a" : "#fff5f5";
  const errorFg = isDark ? "#ff7b72" : "#d73a49";

  let notebook: NbFormat;
  try {
    notebook = JSON.parse(jsonContent) as NbFormat;
  } catch {
    return `<html><body style="color:red;font-family:monospace;padding:16px">Failed to parse notebook JSON</body></html>`;
  }

  const language = notebook.metadata?.kernelspec?.language ?? "python";
  const highlighterLanguage = EXT_TO_LANG[language] ?? language;
  const totalCells = notebook.cells.length;
  const truncatedCells = notebook.cells.slice(0, MAX_NOTEBOOK_CELLS);
  const isTruncated = totalCells > MAX_NOTEBOOK_CELLS;

  const cellsHtml = await Promise.all(
    truncatedCells.map(async (cell) => {
      const source = joinSource(cell.source);

      if (cell.cell_type === "markdown") {
        const htmlBody = await marked.parse(source);
        return `<div class="cell cell-markdown">${htmlBody}</div>`;
      }

      if (cell.cell_type === "code") {
        const highlighted = await highlighter.highlightSnippet(source, highlighterLanguage);
        const execCount = cell.execution_count != null ? String(cell.execution_count) : "&nbsp;";
        const outputsHtml = (cell.outputs ?? []).map((output) => {
          if (output.output_type === "stream") {
            const text = joinSource(output.text ?? "");
            const trimmed = text.length > MAX_OUTPUT_BYTES
              ? `${text.slice(0, MAX_OUTPUT_BYTES)}\n… (출력이 너무 커서 잘렸습니다)`
              : text;
            return `<div class="output output-stream">${ansiToHtml(trimmed)}</div>`;
          }

          if (output.output_type === "error") {
            const traceback = (output.traceback ?? []).map(ansiToHtml).join("\n");
            return `<div class="output output-error">${traceback || escapeHtml(`${output.ename}: ${output.evalue}`)}</div>`;
          }

          const data = output.data ?? {};
          if (data["image/png"]) {
            const src64 = Array.isArray(data["image/png"])
              ? data["image/png"].join("")
              : data["image/png"];
            return `<div class="output output-display"><img src="data:image/png;base64,${src64}" style="max-width:100%" /></div>`;
          }

          if (data["image/svg+xml"]) {
            return `<div class="output output-display">${joinSource(data["image/svg+xml"])}</div>`;
          }

          if (data["text/html"]) {
            return `<div class="output output-display">${joinSource(data["text/html"])}</div>`;
          }

          if (data["text/plain"]) {
            return `<div class="output output-stream">${escapeHtml(joinSource(data["text/plain"]))}</div>`;
          }

          return "";
        }).join("");

        return `<div class="cell cell-code">
  <div class="cell-row">
    <div class="gutter"><span class="exec-count">[${execCount}]:</span></div>
    <pre class="code-block hljs"><code>${highlighted?.highlightedHtml ?? escapeHtml(source)}</code></pre>
  </div>
  ${outputsHtml ? `<div class="cell-row outputs-row"><div class="gutter"></div><div class="outputs">${outputsHtml}</div></div>` : ""}
</div>`;
      }

      return `<div class="cell cell-raw"><pre>${escapeHtml(source)}</pre></div>`;
    })
  );

  const codeTheme = isDark ? `
    .hljs { color: #abb2bf; }
    .hljs-keyword, .hljs-selector-tag { color: #c678dd; }
    .hljs-string, .hljs-attr { color: #98c379; }
    .hljs-number, .hljs-literal { color: #d19a66; }
    .hljs-comment { color: #5c6370; font-style: italic; }
    .hljs-title, .hljs-name { color: #61afef; }
    .hljs-type, .hljs-class { color: #e5c07b; }
    .hljs-built_in, .hljs-builtin-name { color: #e06c75; }
    .hljs-variable { color: #abb2bf; }
    .hljs-params { color: #abb2bf; }
    .hljs-meta { color: #56b6c2; }
  ` : `
    .hljs { color: #383a42; }
    .hljs-keyword, .hljs-selector-tag { color: #a626a4; }
    .hljs-string, .hljs-attr { color: #50a14f; }
    .hljs-number, .hljs-literal { color: #986801; }
    .hljs-comment { color: #9fa0a6; font-style: italic; }
    .hljs-title, .hljs-name { color: #4078f2; }
    .hljs-type, .hljs-class { color: #c18401; }
    .hljs-built_in { color: #0184bc; }
    .hljs-variable { color: #383a42; }
    .hljs-meta { color: #0184bc; }
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.6; color: ${fg}; background: ${bg}; margin: 0; padding: 16px 24px; }
  .cell { margin-bottom: 12px; border: 1px solid ${cellBorderColor}; border-radius: 6px; overflow: hidden; }
  .cell-row { display: flex; align-items: flex-start; }
  .gutter { width: 72px; min-width: 72px; padding: 10px 8px; text-align: right; font-family: monospace; font-size: 11px; color: ${gutterColor}; user-select: none; }
  .exec-count { white-space: nowrap; }
  .code-block { margin: 0; padding: 10px 12px; flex: 1; overflow-x: auto; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; line-height: 1.5; background: ${codeBg}; }
  .code-block code { background: none; padding: 0; }
  .outputs-row { border-top: 1px solid ${cellBorderColor}; }
  .outputs { flex: 1; padding: 0; }
  .output { padding: 8px 12px; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; background: ${outputBg}; }
  .output + .output { border-top: 1px solid ${cellBorderColor}; }
  .output-error { background: ${errorBg}; color: ${errorFg}; }
  .output-display img { max-width: 100%; display: block; }
  .output-display { padding: 8px 12px; background: ${outputBg}; overflow-x: auto; }
  .cell-markdown { padding: 12px 16px; }
  .cell-markdown h1, .cell-markdown h2 { border-bottom: 1px solid ${borderColor}; padding-bottom: 0.3em; }
  .cell-markdown h1 { font-size: 2em; } .cell-markdown h2 { font-size: 1.5em; }
  .cell-markdown h3 { font-size: 1.25em; }
  .cell-markdown p { margin: 0.6em 0; }
  .cell-markdown code { background: ${codeBg}; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
  .cell-markdown pre { background: ${codeBg}; padding: 12px; border-radius: 6px; overflow-x: auto; }
  .cell-markdown pre code { background: none; padding: 0; }
  .cell-markdown blockquote { border-left: 4px solid ${borderColor}; padding: 0 1em; color: ${gutterColor}; margin: 0 0 1em; }
  .cell-markdown table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  .cell-markdown th, .cell-markdown td { border: 1px solid ${borderColor}; padding: 6px 12px; }
  .cell-markdown img { max-width: 100%; border-radius: 4px; }
  .cell-markdown a { color: ${isDark ? MARKDOWN_LINK_COLOR.dark : MARKDOWN_LINK_COLOR.light}; }
  .cell-raw { padding: 12px 16px; font-family: monospace; font-size: 13px; color: ${gutterColor}; }
  ${codeTheme}
</style>
</head>
<body>${cellsHtml.join("\n")}${isTruncated ? `<div style="padding:10px 16px;font-size:12px;color:${isDark ? "#6e7681" : "#9ca3af"};border-top:1px solid ${isDark ? "#21262d" : "#e1e4e8"};margin-top:8px">처음 ${MAX_NOTEBOOK_CELLS}개 셀만 표시됩니다 (전체 ${totalCells}개)</div>` : ""}</body>
</html>`;
};

const createTextHighlighterModule = async (): Promise<TextHighlighterModule> => {
  const [
    { default: hljs },
    { default: langTypescript },
    { default: langJavascript },
    { default: langPython },
    { default: langR },
    { default: langRust },
    { default: langGo },
    { default: langJava },
    { default: langC },
    { default: langCpp },
    { default: langBash },
    { default: langCss },
    { default: langXml },
    { default: langJson },
    { default: langYaml },
    { default: langSql },
    { default: langMarkdown },
    { default: langIni },
    { default: langGraphql },
  ] = await Promise.all([
    import("highlight.js/lib/core"),
    import("highlight.js/lib/languages/typescript"),
    import("highlight.js/lib/languages/javascript"),
    import("highlight.js/lib/languages/python"),
    import("highlight.js/lib/languages/r"),
    import("highlight.js/lib/languages/rust"),
    import("highlight.js/lib/languages/go"),
    import("highlight.js/lib/languages/java"),
    import("highlight.js/lib/languages/c"),
    import("highlight.js/lib/languages/cpp"),
    import("highlight.js/lib/languages/bash"),
    import("highlight.js/lib/languages/css"),
    import("highlight.js/lib/languages/xml"),
    import("highlight.js/lib/languages/json"),
    import("highlight.js/lib/languages/yaml"),
    import("highlight.js/lib/languages/sql"),
    import("highlight.js/lib/languages/markdown"),
    import("highlight.js/lib/languages/ini"),
    import("highlight.js/lib/languages/graphql"),
    import("highlight.js/styles/atom-one-dark.css"),
  ]);

  hljs.registerLanguage("typescript", langTypescript);
  hljs.registerLanguage("javascript", langJavascript);
  hljs.registerLanguage("python", langPython);
  hljs.registerLanguage("r", langR);
  hljs.registerLanguage("rust", langRust);
  hljs.registerLanguage("go", langGo);
  hljs.registerLanguage("java", langJava);
  hljs.registerLanguage("c", langC);
  hljs.registerLanguage("cpp", langCpp);
  hljs.registerLanguage("bash", langBash);
  hljs.registerLanguage("css", langCss);
  hljs.registerLanguage("xml", langXml);
  hljs.registerLanguage("json", langJson);
  hljs.registerLanguage("yaml", langYaml);
  hljs.registerLanguage("sql", langSql);
  hljs.registerLanguage("markdown", langMarkdown);
  hljs.registerLanguage("ini", langIni);
  hljs.registerLanguage("graphql", langGraphql);

  const languageHints = Array.from(new Set(Object.values(EXT_TO_LANG)));

  const highlightSnippet = async (
    content: string,
    language?: string
  ): Promise<TextHighlightResult | null> => {
    try {
      const result = language
        ? hljs.highlight(content, { language, ignoreIllegals: true })
        : hljs.highlightAuto(content, languageHints);
      return {
        highlightedHtml: result.value,
        language: result.language ?? language,
      };
    } catch {
      return null;
    }
  };

  return {
    highlightSnippet,
    highlightText: (content, extension) => highlightSnippet(content, EXT_TO_LANG[extension]),
    highlightSource: async (content, renderExt) => {
      const sourceLanguage = renderExt === "markdown" ? "markdown" : "xml";
      const highlighted = await highlightSnippet(content, sourceLanguage);
      return highlighted?.highlightedHtml ?? null;
    },
  };
};

const defaultLoadTextHighlighter = () => {
  if (!textHighlighterPromise) {
    textHighlighterPromise = createTextHighlighterModule();
  }

  return textHighlighterPromise;
};

const defaultLoadMarkdownRenderer = async (): Promise<MarkdownRendererModule> => {
  const { marked } = await import("marked");

  return {
    renderMarkdown: async (content) => {
      const htmlBody = await marked.parse(content);
      return buildMarkdownHtml(htmlBody);
    },
  };
};

const defaultLoadNotebookRenderer = async (): Promise<NotebookRendererModule> => ({
  renderNotebook: (content) => buildNotebookHtml(content, defaultLoadTextHighlighter),
});

const defaultLoadPptxRenderer = async (): Promise<PptxRendererModule> => ({
  renderPptx: (filePath) => buildPptxHtml(filePath, convertFileSrc),
});

const defaultLoadHwpxRenderer = async (): Promise<HwpxRendererModule> => ({
  renderHwpx: (filePath) => buildHwpxHtml(filePath, convertFileSrc),
});

const defaultLoadXlsxRenderer = async (): Promise<XlsxRendererModule> => ({
  renderXlsx: (filePath) => buildXlsxHtml(filePath, convertFileSrc),
});

const defaultLoadDocxRenderer = async (): Promise<DocxRendererModule> => {
  const { renderDocx } = await import("./quickPreviewDocxRenderer");

  return {
    renderDocx: (filePath) => renderDocx(filePath),
  };
};

export const loadSourceHighlightHtml = async (
  content: string,
  renderExt: string,
  options: Pick<QuickPreviewLoaderOptions, "loadTextHighlighter"> = {}
) => {
  const loadTextHighlighter = options.loadTextHighlighter ?? defaultLoadTextHighlighter;
  const highlighter = await loadTextHighlighter();
  return highlighter.highlightSource(content, renderExt);
};

export const loadPreviewForPath = async (
  path: string,
  options: QuickPreviewLoaderOptions = {}
): Promise<PreviewState> => {
  const extension = getExtension(path);
  const invokeImpl = options.invokeImpl ?? invoke;
  const convertFileSrcImpl = options.convertFileSrcImpl ?? convertFileSrc;
  const fetchImpl = options.fetchImpl ?? fetch;
  const loadTextHighlighter = options.loadTextHighlighter ?? defaultLoadTextHighlighter;
  const loadMarkdownRenderer = options.loadMarkdownRenderer ?? defaultLoadMarkdownRenderer;
  const loadNotebookRenderer = options.loadNotebookRenderer ?? defaultLoadNotebookRenderer;
  const loadPptxRenderer = options.loadPptxRenderer ?? defaultLoadPptxRenderer;
  const loadHwpxRenderer = options.loadHwpxRenderer ?? defaultLoadHwpxRenderer;
  const loadXlsxRenderer = options.loadXlsxRenderer ?? defaultLoadXlsxRenderer;
  const loadDocxRenderer = options.loadDocxRenderer ?? defaultLoadDocxRenderer;

  if (IMAGE_EXTENSIONS.has(extension)) {
    return {
      type: "image",
      src: convertFileSrcImpl(path),
    };
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return {
      type: "video",
      src: convertFileSrcImpl(path),
    };
  }

  if (PDF_EXTENSIONS.has(extension)) {
    return {
      type: "pdf",
      src: convertFileSrcImpl(path),
    };
  }

  if (PPTX_EXTENSIONS.has(extension)) {
    const renderer = await loadPptxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderPptx(path),
      renderExt: "pptx",
    };
  }

  if (HWPX_EXTENSIONS.has(extension)) {
    const renderer = await loadHwpxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderHwpx(path),
      renderExt: "hwpx",
    };
  }

  if (XLSX_EXTENSIONS.has(extension)) {
    const renderer = await loadXlsxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderXlsx(path),
      renderExt: extension,
    };
  }

  if (DOCX_EXTENSIONS.has(extension)) {
    const renderer = await loadDocxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderDocx(path),
      renderExt: "docx",
    };
  }

  if (NOTEBOOK_EXTENSIONS.has(extension)) {
    const content = await fetchPreviewText(path, fetchImpl, convertFileSrcImpl);
    const renderer = await loadNotebookRenderer();
    return {
      type: "rendered",
      content,
      renderedHtml: await renderer.renderNotebook(content),
      renderExt: "ipynb",
    };
  }

  if (RENDER_EXTENSIONS.has(extension)) {
    const content = await invokeImpl<string>("read_file_content", { path });

    if (extension === "md" || extension === "markdown") {
      const renderer = await loadMarkdownRenderer();
      return {
        type: "rendered",
        content,
        renderedHtml: await renderer.renderMarkdown(content),
        renderExt: "markdown",
      };
    }

    return {
      type: "rendered",
      content,
      renderedHtml: content,
      renderExt: "html",
    };
  }

  if (TEXT_EXTENSIONS.has(extension) || extension === "") {
    const content = await invokeImpl<string>("read_file_content", { path });
    const highlighter = await loadTextHighlighter();
    const highlighted = await highlighter.highlightText(content, extension);

    return highlighted
      ? {
          type: "text",
          content,
          highlightedHtml: highlighted.highlightedHtml,
          language: highlighted.language,
        }
      : {
          type: "text",
          content,
        };
  }

  return {
    type: "unsupported",
  };
};
