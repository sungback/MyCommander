import {
  buildPreviewHtmlDocument,
  escapeHtml,
  getPreviewTheme,
  type CsvRendererModule,
} from "./shared";

const MAX_ROWS = 500;
const MAX_COLS = 100;

/** RFC 4180 방식 파서: 따옴표 안의 구분자·줄바꿈·"" 이스케이프를 처리한다. */
export const parseCsv = (
  content: string,
  delimiter: string,
  maxRows = Infinity
): string[][] => {
  const text = content.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length && rows.length < maxRows; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  // 마지막 줄이 줄바꿈 없이 끝난 경우
  if (rows.length < maxRows && (cell !== "" || row.length > 0)) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
};

export const buildCsvHtml = (content: string, extension: string): string => {
  const theme = getPreviewTheme();
  // 한 행 더 읽어 잘렸는지만 판단하고, 거기서 파싱을 멈춘다.
  const parsedRows = parseCsv(content, extension === "tsv" ? "\t" : ",", MAX_ROWS + 1);
  const rowsTruncated = parsedRows.length > MAX_ROWS;
  const rows = parsedRows.slice(0, MAX_ROWS);
  const widestRow = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const maxCols = Math.min(widestRow, MAX_COLS);

  const cells = (row: string[], tag: "th" | "td") =>
    Array.from(
      { length: maxCols },
      (_, columnIndex) => `<${tag}>${escapeHtml(row[columnIndex] ?? "")}</${tag}>`
    ).join("");

  const [header, ...dataRows] = rows;
  const table = header
    ? `<table><thead><tr>${cells(header, "th")}</tr></thead><tbody>${dataRows
        .map((row) => `<tr>${cells(row, "td")}</tr>`)
        .join("")}</tbody></table>`
    : `<div class="empty">( 데이터 없음 )</div>`;

  const notes = [
    rowsTruncated ? `처음 ${MAX_ROWS}행` : "",
    widestRow > MAX_COLS ? `처음 ${MAX_COLS}열` : "",
  ].filter(Boolean);
  const note = notes.length
    ? `<div class="note">${notes.join(", ")}만 표시됩니다</div>`
    : "";

  return buildPreviewHtmlDocument({
    styles: `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 12px; color: ${theme.foreground}; background: ${theme.background}; margin: 0; padding: 8px; }
  table { border-collapse: collapse; min-width: max-content; }
  th, td { padding: 4px 6px; border: 1px solid ${theme.border}; white-space: nowrap; text-align: left; font-weight: normal; }
  th { background: ${theme.codeBackground}; position: sticky; top: 0; }
  .empty { color: ${theme.muted}; font-style: italic; }
  .note { padding: 0 0 8px; font-size: 11px; color: ${theme.muted}; }
`,
    body: `${note}${table}`,
  });
};

export const defaultLoadCsvRenderer = async (): Promise<CsvRendererModule> => ({
  renderCsv: (content, extension) => buildCsvHtml(content, extension),
});
