export interface SqliteDatabasePreview {
  fileSize: number;
  pageSize?: number | null;
  pageCount?: number | null;
  tables: SqliteTablePreview[];
  truncatedTables: boolean;
  maxTables: number;
  maxRowsPerTable: number;
  maxColumnsPerTable: number;
  maxCellChars: number;
}

export interface SqliteTablePreview {
  name: string;
  kind: string;
  columns: SqliteColumnPreview[];
  rows: string[][];
  truncatedRows: boolean;
  truncatedColumns: boolean;
  sampleError?: string | null;
}

export interface SqliteColumnPreview {
  name: string;
  dataType: string;
  notNull: boolean;
  primaryKey: boolean;
}
