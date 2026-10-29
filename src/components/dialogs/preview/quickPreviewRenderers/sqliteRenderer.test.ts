import { describe, expect, it } from "vitest";
import type { SqliteDatabasePreview } from "../../../../types/sqlitePreview";
import { buildSqlitePreviewHtml } from "./sqliteRenderer";

describe("sqliteRenderer", () => {
  it("renders escaped table schema and sample rows", () => {
    document.documentElement.dataset.theme = "dark";
    const database: SqliteDatabasePreview = {
      fileSize: 4096,
      pageSize: 4096,
      pageCount: 1,
      tables: [
        {
          name: "notes<script>",
          kind: "table",
          columns: [
            {
              name: "id",
              dataType: "INTEGER",
              notNull: false,
              primaryKey: true,
            },
            {
              name: "title",
              dataType: "TEXT",
              notNull: true,
              primaryKey: false,
            },
          ],
          rows: [["1", "<hello>"]],
          truncatedRows: true,
          truncatedColumns: false,
        },
      ],
      truncatedTables: false,
      maxTables: 20,
      maxRowsPerTable: 20,
      maxColumnsPerTable: 40,
      maxCellChars: 500,
    };

    const html = buildSqlitePreviewHtml(database);

    expect(html).toContain("SQLite");
    expect(html).toContain("notes&lt;script&gt;");
    expect(html).toContain("id (INTEGER, PK)");
    expect(html).toContain("title (TEXT, NOT NULL)");
    expect(html).toContain("&lt;hello&gt;");
    expect(html).toContain("처음 20개 행만 표시됩니다.");
  });
});
