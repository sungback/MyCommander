import {
  ansiToHtml,
  buildPreviewHtmlDocument,
  escapeHtml,
  EXT_TO_LANG,
  getPreviewTheme,
  joinSource,
  MAX_NOTEBOOK_CELLS,
  MAX_OUTPUT_BYTES,
  NotebookRendererModule,
} from "./shared";
import { defaultLoadTextHighlighter } from "./textHighlighter";

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

const buildNotebookHtml = async (jsonContent: string): Promise<string> => {
  const [{ marked }, highlighter] = await Promise.all([
    import("marked"),
    defaultLoadTextHighlighter(),
  ]);

  const theme = getPreviewTheme();

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
        const outputsHtml = (cell.outputs ?? [])
          .map((output) => {
            if (output.output_type === "stream") {
              const text = joinSource(output.text ?? "");
              const trimmed =
                text.length > MAX_OUTPUT_BYTES
                  ? `${text.slice(0, MAX_OUTPUT_BYTES)}\n… (출력이 너무 커서 잘렸습니다)`
                  : text;
              return `<div class="output output-stream">${ansiToHtml(trimmed)}</div>`;
            }

            if (output.output_type === "error") {
              const traceback = (output.traceback ?? []).map(ansiToHtml).join("\n");
              return `<div class="output output-error">${
                traceback || escapeHtml(`${output.ename}: ${output.evalue}`)
              }</div>`;
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
              return `<div class="output output-stream">${escapeHtml(
                joinSource(data["text/plain"])
              )}</div>`;
            }

            return "";
          })
          .join("");

        return `<div class="cell cell-code">
  <div class="cell-row">
    <div class="gutter"><span class="exec-count">[${execCount}]:</span></div>
    <pre class="code-block hljs"><code>${highlighted?.highlightedHtml ?? escapeHtml(source)}</code></pre>
  </div>
  ${
    outputsHtml
      ? `<div class="cell-row outputs-row"><div class="gutter"></div><div class="outputs">${outputsHtml}</div></div>`
      : ""
  }
</div>`;
      }

      return `<div class="cell cell-raw"><pre>${escapeHtml(source)}</pre></div>`;
    })
  );

  const codeTheme = theme.isDark
    ? `
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
  `
    : `
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

  const truncatedNote = isTruncated
    ? `<div style="padding:10px 16px;font-size:12px;color:${theme.muted};border-top:1px solid ${theme.divider};margin-top:8px">처음 ${MAX_NOTEBOOK_CELLS}개 셀만 표시됩니다 (전체 ${totalCells}개)</div>`
    : "";

  return buildPreviewHtmlDocument({
    styles: `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.6; color: ${theme.foreground}; background: ${theme.background}; margin: 0; padding: 16px 24px; }
  .cell { margin-bottom: 12px; border: 1px solid ${theme.divider}; border-radius: 6px; overflow: hidden; }
  .cell-row { display: flex; align-items: flex-start; }
  .gutter { width: 72px; min-width: 72px; padding: 10px 8px; text-align: right; font-family: monospace; font-size: 11px; color: ${theme.muted}; user-select: none; }
  .exec-count { white-space: nowrap; }
  .code-block { margin: 0; padding: 10px 12px; flex: 1; overflow-x: auto; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; line-height: 1.5; background: ${theme.codeBackground}; }
  .code-block code { background: none; padding: 0; }
  .outputs-row { border-top: 1px solid ${theme.divider}; }
  .outputs { flex: 1; padding: 0; }
  .output { padding: 8px 12px; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; background: ${theme.outputBackground}; }
  .output + .output { border-top: 1px solid ${theme.divider}; }
  .output-error { background: ${theme.errorBackground}; color: ${theme.errorForeground}; }
  .output-display img { max-width: 100%; display: block; }
  .output-display { padding: 8px 12px; background: ${theme.outputBackground}; overflow-x: auto; }
  .cell-markdown { padding: 12px 16px; }
  .cell-markdown h1, .cell-markdown h2 { border-bottom: 1px solid ${theme.border}; padding-bottom: 0.3em; }
  .cell-markdown h1 { font-size: 2em; } .cell-markdown h2 { font-size: 1.5em; }
  .cell-markdown h3 { font-size: 1.25em; }
  .cell-markdown p { margin: 0.6em 0; }
  .cell-markdown code { background: ${theme.codeBackground}; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
  .cell-markdown pre { background: ${theme.codeBackground}; padding: 12px; border-radius: 6px; overflow-x: auto; }
  .cell-markdown pre code { background: none; padding: 0; }
  .cell-markdown blockquote { border-left: 4px solid ${theme.border}; padding: 0 1em; color: ${theme.muted}; margin: 0 0 1em; }
  .cell-markdown table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  .cell-markdown th, .cell-markdown td { border: 1px solid ${theme.border}; padding: 6px 12px; }
  .cell-markdown img { max-width: 100%; border-radius: 4px; }
  .cell-markdown a { color: ${theme.link}; }
  .cell-raw { padding: 12px 16px; font-family: monospace; font-size: 13px; color: ${theme.muted}; }
  ${codeTheme}
`,
    body: `${cellsHtml.join("\n")}${truncatedNote}`,
  });
};

export const defaultLoadNotebookRenderer = async (): Promise<NotebookRendererModule> => ({
  renderNotebook: (content) => buildNotebookHtml(content),
});
