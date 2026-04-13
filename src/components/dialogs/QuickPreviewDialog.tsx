import React, { useEffect, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { X, FileText, ImageIcon, VideoIcon, AlertCircle, Loader2, Code2, Eye } from "lucide-react";
import { useDialogStore } from "../../store/dialogStore";
import { marked } from "marked";
import JSZip from "jszip";
import * as XLSX from "xlsx";

import hljs from "highlight.js/lib/core";
import langTypescript from "highlight.js/lib/languages/typescript";
import langJavascript from "highlight.js/lib/languages/javascript";
import langPython from "highlight.js/lib/languages/python";
import langRust from "highlight.js/lib/languages/rust";
import langGo from "highlight.js/lib/languages/go";
import langJava from "highlight.js/lib/languages/java";
import langC from "highlight.js/lib/languages/c";
import langCpp from "highlight.js/lib/languages/cpp";
import langBash from "highlight.js/lib/languages/bash";
import langCss from "highlight.js/lib/languages/css";
import langXml from "highlight.js/lib/languages/xml";
import langJson from "highlight.js/lib/languages/json";
import langYaml from "highlight.js/lib/languages/yaml";
import langSql from "highlight.js/lib/languages/sql";
import langMarkdown from "highlight.js/lib/languages/markdown";
import langIni from "highlight.js/lib/languages/ini";
import langGraphql from "highlight.js/lib/languages/graphql";
import "highlight.js/styles/atom-one-dark.css";

hljs.registerLanguage("typescript", langTypescript);
hljs.registerLanguage("javascript", langJavascript);
hljs.registerLanguage("python", langPython);
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

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  py: "python",
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

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tiff", "avif",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4", "webm", "mov", "mkv", "avi", "m4v",
]);

// md/html은 렌더링 처리
const RENDER_EXTENSIONS = new Set(["md", "markdown", "html", "htm"]);

// Jupyter notebook
const NOTEBOOK_EXTENSIONS = new Set(["ipynb"]);

// PDF
const PDF_EXTENSIONS = new Set(["pdf"]);

// PPTX
const PPTX_EXTENSIONS = new Set(["pptx"]);

// HWPX
const HWPX_EXTENSIONS = new Set(["hwpx"]);

// XLSX
const XLSX_EXTENSIONS = new Set(["xlsx", "xls"]);

const TEXT_EXTENSIONS = new Set([
  "txt", "json", "jsonc", "ts", "tsx", "js", "jsx",
  "css", "scss", "sass", "less", "xml", "yaml", "yml", "toml",
  "rs", "py", "go", "java", "c", "cpp", "h", "hpp", "sh", "bash", "zsh",
  "fish", "env", "gitignore", "gitattributes", "editorconfig", "lock",
  "log", "csv", "sql", "graphql", "gql", "vue", "svelte", "astro", "ini",
  "cfg", "conf", "config", "makefile",
]);

const getExtension = (path: string): string => {
  const fileName = path.split(/[\\/]/).pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return fileName.slice(dotIndex + 1).toLowerCase();
};

const getFileName = (path: string): string =>
  path.split(/[\\/]/).pop() ?? path;

const getAppTheme = (): "dark" | "light" =>
  (document.documentElement.dataset.theme as "dark" | "light") ?? "dark";

const buildMarkdownHtml = (body: string): string => {
  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const codeBg = isDark ? "#161b22" : "#f6f8fa";
  const blockquoteColor = isDark ? "#8b949e" : "#636c76";
  const linkColor = isDark ? "#58a6ff" : "#0969da";
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

// ---------- Jupyter notebook helpers ----------

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

const joinSource = (src: string | string[]): string =>
  Array.isArray(src) ? src.join("") : src;

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ansiToHtml = (s: string): string =>
  escapeHtml(s).replace(/\x1b\[[0-9;]*m/g, "");

const buildNotebookHtml = async (jsonContent: string): Promise<string> => {
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

  let nb: NbFormat;
  try {
    nb = JSON.parse(jsonContent) as NbFormat;
  } catch {
    return `<html><body style="color:red;font-family:monospace;padding:16px">Failed to parse notebook JSON</body></html>`;
  }

  const lang = nb.metadata?.kernelspec?.language ?? "python";
  const hljsLang = EXT_TO_LANG[lang] ?? lang;

  const cellsHtml = await Promise.all(
    nb.cells.map(async (cell) => {
      const src = joinSource(cell.source);

      if (cell.cell_type === "markdown") {
        const htmlBody = await marked.parse(src);
        return `<div class="cell cell-markdown">${htmlBody}</div>`;
      }

      if (cell.cell_type === "code") {
        let highlighted = escapeHtml(src);
        try {
          highlighted = hljs.highlight(src, { language: hljsLang, ignoreIllegals: true }).value;
        } catch { /* keep escaped */ }

        const execCount = cell.execution_count != null ? String(cell.execution_count) : "&nbsp;";
        const outputsHtml = (cell.outputs ?? []).map((out) => {
          if (out.output_type === "stream") {
            const text = joinSource(out.text ?? "");
            return `<div class="output output-stream">${ansiToHtml(text)}</div>`;
          }
          if (out.output_type === "error") {
            const tb = (out.traceback ?? []).map(ansiToHtml).join("\n");
            return `<div class="output output-error">${tb || escapeHtml(`${out.ename}: ${out.evalue}`)}</div>`;
          }
          // execute_result / display_data
          const data = out.data ?? {};
          if (data["image/png"]) {
            const src64 = Array.isArray(data["image/png"]) ? data["image/png"].join("") : data["image/png"];
            return `<div class="output output-display"><img src="data:image/png;base64,${src64}" style="max-width:100%" /></div>`;
          }
          if (data["image/svg+xml"]) {
            const svg = joinSource(data["image/svg+xml"]);
            return `<div class="output output-display">${svg}</div>`;
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
    <pre class="code-block hljs"><code>${highlighted}</code></pre>
  </div>
  ${outputsHtml ? `<div class="cell-row outputs-row"><div class="gutter"></div><div class="outputs">${outputsHtml}</div></div>` : ""}
</div>`;
      }

      // raw
      return `<div class="cell cell-raw"><pre>${escapeHtml(src)}</pre></div>`;
    })
  );

  // Inline a minimal atom-one-dark-ish code theme
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
  .cell-markdown a { color: ${isDark ? "#58a6ff" : "#0969da"}; }
  .cell-raw { padding: 12px 16px; font-family: monospace; font-size: 13px; color: ${gutterColor}; }
  ${codeTheme}
</style>
</head>
<body>${cellsHtml.join("\n")}</body>
</html>`;
};

// ---------- end notebook helpers ----------

// ---------- PPTX helpers ----------

const extractSlideTexts = (xmlStr: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "text/xml");
  const NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const nodes = doc.getElementsByTagNameNS(NS, "t");
  const texts: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const t = nodes[i].textContent?.trim();
    if (t) texts.push(t);
  }
  return texts;
};

const buildPptxHtml = async (filePath: string): Promise<string> => {
  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const cardBg = isDark ? "#161b22" : "#f6f8fa";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const badgeColor = isDark ? "#58a6ff" : "#0969da";
  const badgeBg = isDark ? "rgba(88,166,255,0.12)" : "rgba(9,105,218,0.1)";
  const emptyColor = isDark ? "#6e7681" : "#9ca3af";

  const url = convertFileSrc(filePath);
  const buf = await fetch(url).then((r) => r.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);

  // 슬라이드 파일 수집 및 번호순 정렬
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  const slidesHtml = await Promise.all(
    slideEntries.map(async (name, idx) => {
      const xmlStr = await zip.files[name].async("string");
      const texts = extractSlideTexts(xmlStr);
      const content = texts.length > 0
        ? texts.map((t) => `<div class="slide-line">${escapeHtml(t)}</div>`).join("")
        : `<div class="slide-empty">( 텍스트 없음 )</div>`;
      return `<div class="slide-card">
  <div class="slide-header">
    <span class="slide-badge">슬라이드 ${idx + 1}</span>
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

// ---------- end PPTX helpers ----------

// ---------- HWPX helpers ----------

const buildHwpxHtml = async (filePath: string): Promise<string> => {
  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const cardBg = isDark ? "#161b22" : "#f6f8fa";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const badgeColor = isDark ? "#58a6ff" : "#0969da";
  const badgeBg = isDark ? "rgba(88,166,255,0.12)" : "rgba(9,105,218,0.1)";
  const emptyColor = isDark ? "#6e7681" : "#9ca3af";
  const dividerColor = isDark ? "#21262d" : "#e1e4e8";

  const url = convertFileSrc(filePath);
  const buf = await fetch(url).then((r) => r.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);

  // section*.xml 파일 수집 및 번호순 정렬
  const sectionEntries = Object.keys(zip.files)
    .filter((name) => /^[Cc]ontents\/[Ss]ection\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  if (sectionEntries.length === 0) {
    return `<html><body style="color:${emptyColor};font-family:sans-serif;padding:32px;background:${bg}">섹션 파일을 찾을 수 없습니다.</body></html>`;
  }

  // 각 섹션에서 텍스트 추출
  const sectionsHtml = await Promise.all(
    sectionEntries.map(async (name, idx) => {
      const xmlStr = await zip.files[name].async("string");
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, "text/xml");

      // <hp:t> 또는 로컬명 "t" (네임스페이스 무관하게 수집)
      const allT = doc.getElementsByTagName("hp:t");
      const paragraphs: string[] = [];

      // 단락(<hp:p>) 단위로 묶기
      const allP = doc.getElementsByTagName("hp:p");
      if (allP.length > 0) {
        for (let i = 0; i < allP.length; i++) {
          const tNodes = allP[i].getElementsByTagName("hp:t");
          const line = Array.from(tNodes)
            .map((n) => n.textContent ?? "")
            .join("");
          if (line.trim()) paragraphs.push(line.trim());
        }
      } else {
        // fallback: <hp:t> 직접 수집
        for (let i = 0; i < allT.length; i++) {
          const t = allT[i].textContent?.trim();
          if (t) paragraphs.push(t);
        }
      }

      const content = paragraphs.length > 0
        ? paragraphs.map((p) => `<p class="hwp-para">${escapeHtml(p)}</p>`).join("")
        : `<p class="hwp-empty">( 텍스트 없음 )</p>`;

      return `<div class="section-card">
  <div class="section-header">
    <span class="section-badge">섹션 ${idx + 1}</span>
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

// ---------- end HWPX helpers ----------

// ---------- XLSX helpers ----------

const MAX_ROWS = 500;

const buildXlsxHtml = async (filePath: string): Promise<string> => {
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

  const url = convertFileSrc(filePath);
  const buf = await fetch(url).then((r) => r.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });

  const sheetsHtml = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    const truncated = rows.length > MAX_ROWS;
    const displayRows = rows.slice(0, MAX_ROWS) as unknown[][];

    if (displayRows.length === 0) {
      return `<div class="sheet-block">
  <div class="sheet-header"><span class="sheet-badge">${escapeHtml(sheetName)}</span></div>
  <div class="sheet-empty">( 데이터 없음 )</div>
</div>`;
    }

    // 최대 컬럼 수 계산
    const maxCols = displayRows.reduce((m, r) => Math.max(m, r.length), 0);

    const headerRow = displayRows[0];
    const dataRows = displayRows.slice(1);

    const theadHtml = `<thead><tr>${
      headerRow.map((cell) =>
        `<th>${escapeHtml(String(cell ?? ""))}</th>`
      ).join("")
    }</tr></thead>`;

    const tbodyHtml = `<tbody>${
      dataRows.map((row, i) =>
        `<tr class="${i % 2 === 1 ? "even" : ""}">${
          Array.from({ length: maxCols }, (_, ci) =>
            `<td>${escapeHtml(String((row as unknown[])[ci] ?? ""))}</td>`
          ).join("")
        }</tr>`
      ).join("")
    }</tbody>`;

    const note = truncated
      ? `<div class="truncate-note">처음 ${MAX_ROWS}행만 표시됩니다 (전체 ${rows.length}행)</div>`
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

// ---------- end XLSX helpers ----------

type PreviewType = "image" | "video" | "pdf" | "text" | "rendered" | "unsupported" | "loading" | "error";

interface PreviewState {
  type: PreviewType;
  content?: string;
  highlightedHtml?: string;
  renderedHtml?: string;
  language?: string;
  src?: string;
  error?: string;
  renderExt?: string;
}

export const QuickPreviewDialog: React.FC = () => {
  const { openDialog, dialogTarget, closeDialog } = useDialogStore();
  const isOpen = openDialog === "preview" && dialogTarget != null;
  const filePath = dialogTarget?.path ?? "";
  const fileName = getFileName(filePath);

  const [preview, setPreview] = useState<PreviewState>({ type: "loading" });
  const [showSource, setShowSource] = useState(false);
  const lastTargetPanelRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (dialogTarget?.panelId) {
      lastTargetPanelRef.current = dialogTarget.panelId;
    }
  }, [dialogTarget]);

  // 파일이 바뀌면 소스 보기 초기화
  useEffect(() => {
    setShowSource(false);
  }, [filePath]);

  const loadPreview = useCallback(async (path: string) => {
    setPreview({ type: "loading" });
    const ext = getExtension(path);

    try {
      if (IMAGE_EXTENSIONS.has(ext)) {
        const src = convertFileSrc(path);
        setPreview({ type: "image", src });
        return;
      }

      if (VIDEO_EXTENSIONS.has(ext)) {
        const src = convertFileSrc(path);
        setPreview({ type: "video", src });
        return;
      }

      if (PDF_EXTENSIONS.has(ext)) {
        setPreview({ type: "pdf", src: convertFileSrc(path) });
        return;
      }

      if (PPTX_EXTENSIONS.has(ext)) {
        const renderedHtml = await buildPptxHtml(path);
        setPreview({ type: "rendered", renderedHtml, renderExt: "pptx" });
        return;
      }

      if (HWPX_EXTENSIONS.has(ext)) {
        const renderedHtml = await buildHwpxHtml(path);
        setPreview({ type: "rendered", renderedHtml, renderExt: "hwpx" });
        return;
      }

      if (XLSX_EXTENSIONS.has(ext)) {
        const renderedHtml = await buildXlsxHtml(path);
        setPreview({ type: "rendered", renderedHtml, renderExt: ext });
        return;
      }

      if (NOTEBOOK_EXTENSIONS.has(ext)) {
        const content = await invoke<string>("read_file_content", { path });
        const renderedHtml = await buildNotebookHtml(content);
        setPreview({ type: "rendered", content, renderedHtml, renderExt: "ipynb" });
        return;
      }

      if (RENDER_EXTENSIONS.has(ext)) {
        const content = await invoke<string>("read_file_content", { path });
        if (ext === "md" || ext === "markdown") {
          const htmlBody = await marked.parse(content);
          setPreview({
            type: "rendered",
            content,
            renderedHtml: buildMarkdownHtml(htmlBody),
            renderExt: "markdown",
          });
        } else {
          // html / htm — 직접 렌더링
          setPreview({
            type: "rendered",
            content,
            renderedHtml: content,
            renderExt: "html",
          });
        }
        return;
      }

      if (TEXT_EXTENSIONS.has(ext) || ext === "") {
        const content = await invoke<string>("read_file_content", { path });
        const lang = EXT_TO_LANG[ext];
        try {
          const result = lang
            ? hljs.highlight(content, { language: lang, ignoreIllegals: true })
            : hljs.highlightAuto(content, Object.values(EXT_TO_LANG));
          setPreview({
            type: "text",
            content,
            highlightedHtml: result.value,
            language: result.language ?? lang,
          });
        } catch {
          setPreview({ type: "text", content });
        }
        return;
      }

      setPreview({ type: "unsupported" });
    } catch (err) {
      console.error("QuickPreview: failed to load file", err);
      setPreview({
        type: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen && filePath) {
      void loadPreview(filePath);
    }
  }, [isOpen, filePath, loadPreview]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        closeDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, closeDialog]);

  const isRendered = preview.type === "rendered";
  const canToggleSource = isRendered && Boolean(preview.content);

  // 소스 보기 시 highlight 적용
  const sourceHighlight = (() => {
    if (!canToggleSource || !showSource || !preview.content) return null;
    const ext = preview.renderExt ?? "";
    const lang = ext === "markdown" ? "markdown" : "xml";
    try {
      return hljs.highlight(preview.content, { language: lang, ignoreIllegals: true }).value;
    } catch {
      return null;
    }
  })();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const targetPanelId = dialogTarget?.panelId || lastTargetPanelRef.current;
            if (targetPanelId) {
              const panelEl = document.querySelector(`[data-panel-id="${targetPanelId}"]`) as HTMLElement;
              if (panelEl) {
                setTimeout(() => { panelEl.focus({ preventScroll: true }); }, 10);
              }
            }
          }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col bg-bg-panel border border-border-color rounded-lg shadow-2xl focus:outline-none"
          style={{ width: "min(95vw, 1280px)", height: "min(95vh, 900px)" }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {preview.type === "image" ? (
                <ImageIcon size={14} className="text-text-secondary shrink-0" />
              ) : preview.type === "video" ? (
                <VideoIcon size={14} className="text-text-secondary shrink-0" />
              ) : isRendered ? (
                <Eye size={14} className="text-text-secondary shrink-0" />
              ) : (
                <FileText size={14} className="text-text-secondary shrink-0" />
              )}
              {preview.type === "pdf" && (
                <span className="shrink-0 text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-mono">PDF</span>
              )}
              <Dialog.Title className="text-sm font-medium text-text-primary truncate">
                {fileName}
              </Dialog.Title>
              {preview.language && (
                <span className="shrink-0 text-xs text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded font-mono">
                  {preview.language}
                </span>
              )}
              {preview.renderExt && (
                <span className="shrink-0 text-xs text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded font-mono">
                  {preview.renderExt}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 ml-4 shrink-0">
              {canToggleSource && (
                <button
                  onClick={() => setShowSource((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  title={showSource ? "렌더링 보기" : "소스 보기"}
                >
                  {showSource ? <Eye size={12} /> : <Code2 size={12} />}
                  <span>{showSource ? "렌더링" : "소스"}</span>
                </button>
              )}
              <button
                onClick={closeDialog}
                className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close preview"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* 본문 */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {preview.type === "loading" && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-text-secondary">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-xs">Loading preview...</p>
              </div>
            )}

            {preview.type === "image" && preview.src && (
              <div className="flex items-center justify-center p-4 overflow-auto flex-1">
                <img
                  src={preview.src}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain rounded select-none"
                  draggable={false}
                />
              </div>
            )}

            {preview.type === "video" && preview.src && (
              <div className="flex items-center justify-center flex-1 bg-black">
                <video
                  src={preview.src}
                  controls
                  className="max-w-full max-h-full"
                  style={{ maxHeight: "calc(100% - 0px)" }}
                >
                  지원하지 않는 형식입니다.
                </video>
              </div>
            )}

            {preview.type === "pdf" && preview.src && (
              <iframe
                src={preview.src}
                className="w-full flex-1 border-none"
                title="PDF preview"
              />
            )}

            {/* 렌더링 미리보기 (md / html) */}
            {preview.type === "rendered" && !showSource && preview.renderedHtml && (
              <iframe
                srcDoc={preview.renderedHtml}
                className="w-full flex-1 border-none"
                sandbox="allow-same-origin"
                title="rendered preview"
              />
            )}

            {/* 소스 보기 (렌더링 파일) */}
            {preview.type === "rendered" && showSource && (
              sourceHighlight ? (
                <pre className="flex-1 overflow-auto text-xs font-mono leading-relaxed m-0">
                  <code
                    className="hljs block p-4 min-h-full"
                    dangerouslySetInnerHTML={{ __html: sourceHighlight }}
                  />
                </pre>
              ) : (
                <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-primary whitespace-pre-wrap break-words leading-relaxed">
                  {preview.content}
                </pre>
              )
            )}

            {/* 텍스트 / 코드 미리보기 */}
            {preview.type === "text" && (
              preview.highlightedHtml ? (
                <pre className="flex-1 overflow-auto text-xs font-mono leading-relaxed m-0">
                  <code
                    className="hljs block p-4 min-h-full"
                    dangerouslySetInnerHTML={{ __html: preview.highlightedHtml }}
                  />
                </pre>
              ) : (
                <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-primary whitespace-pre-wrap break-words leading-relaxed">
                  {preview.content}
                </pre>
              )
            )}

            {preview.type === "unsupported" && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-text-secondary">
                <FileText size={24} />
                <p className="text-sm font-medium text-text-primary">Preview not supported</p>
                <p className="text-xs">This file type cannot be previewed.</p>
              </div>
            )}

            {preview.type === "error" && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-text-secondary">
                <AlertCircle size={24} className="text-red-500" />
                <p className="text-sm font-medium text-text-primary">Failed to load preview</p>
                {preview.error && (
                  <p className="text-xs font-mono text-red-400 max-w-xs text-center break-all">
                    {preview.error}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="px-4 py-2 border-t border-border-color shrink-0 flex justify-between items-center">
            <span className="text-xs text-text-secondary font-mono truncate">{filePath}</span>
            <span className="text-xs text-text-secondary shrink-0 ml-4">
              Press{" "}
              <kbd className="px-1 py-0.5 bg-bg-secondary border border-border-color rounded text-xs">Space</kbd>
              {" "}or{" "}
              <kbd className="px-1 py-0.5 bg-bg-secondary border border-border-color rounded text-xs">Esc</kbd>
              {" "}to close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
