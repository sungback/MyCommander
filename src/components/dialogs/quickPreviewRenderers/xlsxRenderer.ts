import {
  buildPreviewHtmlDocument,
  escapeHtml,
  getPreviewTheme,
  XlsxRendererModule,
} from "./shared";
import { convertFileSrc } from "@tauri-apps/api/core";

const buildXlsxHtml = async (filePath: string): Promise<string> => {
  const XLSX = await import("xlsx");
  const theme = getPreviewTheme();
  const maxRows = 500;

  const url = convertFileSrc(filePath);
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
      .map(
        (row, rowIndex) =>
          `<tr class="${rowIndex % 2 === 1 ? "even" : ""}">${Array.from(
            { length: maxCols },
            (_, columnIndex) =>
              `<td>${escapeHtml(String((row as unknown[])[columnIndex] ?? ""))}</td>`
          ).join("")}</tr>`
      )
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

  return buildPreviewHtmlDocument({
    styles: `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 13px; color: ${theme.foreground}; background: ${theme.background}; margin: 0; padding: 16px 20px; }
  .sheet-block { margin-bottom: 20px; border: 1px solid ${theme.border}; border-radius: 8px; overflow: hidden; }
  .sheet-header { background: ${theme.codeBackground}; padding: 8px 14px; border-bottom: 1px solid ${theme.divider}; }
  .sheet-badge { font-size: 11px; font-weight: 600; color: ${theme.badgeGreen}; background: ${theme.badgeGreenBackground}; padding: 2px 8px; border-radius: 10px; }
  .sheet-empty { padding: 14px 16px; font-size: 12px; color: ${theme.muted}; font-style: italic; }
  .truncate-note { padding: 6px 14px; font-size: 11px; color: ${theme.muted}; background: ${theme.codeBackground}; border-bottom: 1px solid ${theme.divider}; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; min-width: max-content; }
  th { background: ${theme.codeBackground}; font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid ${theme.border}; white-space: nowrap; position: sticky; top: 0; }
  td { padding: 5px 10px; border: 1px solid ${theme.border}; white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
  tr.even td { background: ${theme.alternateBackground}; }
`,
    body: sheetsHtml.join("\n"),
  });
};

export const defaultLoadXlsxRenderer = async (): Promise<XlsxRendererModule> => ({
  renderXlsx: (filePath) => buildXlsxHtml(filePath),
});
