import { useFileSystem } from "../../../hooks/useFileSystem";
import type {
  SqliteColumnPreview,
  SqliteDatabasePreview,
  SqliteTablePreview,
} from "../../../types/sqlitePreview";
import { formatSize } from "../../../utils/format";
import {
  buildPreviewHtmlDocument,
  escapeHtml,
  getPreviewTheme,
  type SqliteRendererModule,
} from "./shared";

const getColumnLabel = (column: SqliteColumnPreview): string => {
  const tags = [
    column.dataType.trim(),
    column.primaryKey ? "PK" : "",
    column.notNull ? "NOT NULL" : "",
  ].filter(Boolean);

  return tags.length > 0 ? `${column.name} (${tags.join(", ")})` : column.name;
};

const buildTableHtml = (
  table: SqliteTablePreview,
  maxRowsPerTable: number,
  maxColumnsPerTable: number
): string => {
  const columnHeaders = table.columns
    .map((column) => `<th>${escapeHtml(getColumnLabel(column))}</th>`)
    .join("");

  const rowsHtml = table.rows
    .map(
      (row, rowIndex) =>
        `<tr class="${rowIndex % 2 === 1 ? "even" : ""}">${row
          .map((value) => `<td>${escapeHtml(value)}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const notes = [
    table.truncatedColumns
      ? `처음 ${maxColumnsPerTable}개 컬럼만 표시됩니다.`
      : "",
    table.truncatedRows ? `처음 ${maxRowsPerTable}개 행만 표시됩니다.` : "",
  ].filter(Boolean);

  const notesHtml =
    notes.length > 0
      ? `<div class="truncate-note">${notes.map(escapeHtml).join(" ")}</div>`
      : "";

  const sampleErrorHtml = table.sampleError
    ? `<div class="sample-error">샘플 행을 읽지 못했습니다: ${escapeHtml(table.sampleError)}</div>`
    : "";

  const bodyHtml =
    table.columns.length === 0 && table.rows.length === 0 && !table.sampleError
      ? `<div class="empty">( 컬럼 또는 행 없음 )</div>`
      : `<div class="table-wrap"><table><thead><tr>${columnHeaders}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;

  return `<section class="table-block">
  <div class="table-header">
    <div class="table-title">${escapeHtml(table.name)}</div>
    <span class="kind-badge">${escapeHtml(table.kind)}</span>
  </div>
  ${notesHtml}
  ${sampleErrorHtml}
  ${bodyHtml}
</section>`;
};

export const buildSqlitePreviewHtml = (database: SqliteDatabasePreview): string => {
  const theme = getPreviewTheme();
  const stats = [
    `${database.tables.length}${database.truncatedTables ? "+" : ""} objects`,
    formatSize(database.fileSize),
    database.pageSize ? `page ${database.pageSize} B` : "",
    database.pageCount ? `${database.pageCount} pages` : "",
  ].filter(Boolean);

  const emptyHtml =
    database.tables.length === 0
      ? `<div class="empty-state">표시할 사용자 테이블이나 뷰가 없습니다.</div>`
      : "";

  const truncationHtml = database.truncatedTables
    ? `<div class="truncate-note">처음 ${database.maxTables}개 테이블/뷰만 표시됩니다.</div>`
    : "";

  return buildPreviewHtmlDocument({
    styles: `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 13px; color: ${theme.foreground}; background: ${theme.background}; margin: 0; padding: 16px 20px; }
  .summary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
  .db-badge { font-size: 11px; font-weight: 700; letter-spacing: 0; color: ${theme.badgeBlue}; background: ${theme.badgeBlueBackground}; padding: 3px 8px; border-radius: 999px; }
  .stat { color: ${theme.muted}; font-size: 12px; }
  .table-block { margin-bottom: 20px; border: 1px solid ${theme.border}; border-radius: 8px; overflow: hidden; }
  .table-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: ${theme.codeBackground}; padding: 9px 14px; border-bottom: 1px solid ${theme.divider}; }
  .table-title { font-weight: 650; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kind-badge { flex: none; font-size: 11px; color: ${theme.badgeGreen}; background: ${theme.badgeGreenBackground}; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; }
  .truncate-note { padding: 6px 14px; font-size: 11px; color: ${theme.muted}; background: ${theme.codeBackground}; border-bottom: 1px solid ${theme.divider}; }
  .sample-error { padding: 8px 14px; font-size: 12px; color: ${theme.errorForeground}; background: ${theme.errorBackground}; border-bottom: 1px solid ${theme.divider}; }
  .table-wrap { overflow: auto; max-height: 420px; }
  table { border-collapse: collapse; width: 100%; min-width: max-content; }
  th { background: ${theme.codeBackground}; font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid ${theme.border}; white-space: nowrap; position: sticky; top: 0; z-index: 1; }
  td { padding: 5px 10px; border: 1px solid ${theme.border}; white-space: nowrap; max-width: 360px; overflow: hidden; text-overflow: ellipsis; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 12px; }
  tr.even td { background: ${theme.alternateBackground}; }
  .empty, .empty-state { padding: 14px 16px; font-size: 12px; color: ${theme.muted}; font-style: italic; }
`,
    body: `<div class="summary"><span class="db-badge">SQLite</span>${stats
      .map((stat) => `<span class="stat">${escapeHtml(stat)}</span>`)
      .join("")}</div>
${truncationHtml}
${emptyHtml}
${database.tables
  .map((table) =>
    buildTableHtml(table, database.maxRowsPerTable, database.maxColumnsPerTable)
  )
  .join("\n")}`,
  });
};

export const defaultLoadSqliteRenderer = async (): Promise<SqliteRendererModule> => ({
  renderSqlite: async (filePath) => {
    const database = await useFileSystem().previewSqliteDatabase(filePath);
    return buildSqlitePreviewHtml(database);
  },
});
