use rusqlite::{types::ValueRef, Connection, OpenFlags};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::Duration;

const MAX_TABLES: usize = 20;
const MAX_ROWS_PER_TABLE: usize = 20;
const MAX_COLUMNS_PER_TABLE: usize = 40;
const MAX_CELL_CHARS: usize = 500;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteDatabasePreview {
    pub file_size: u64,
    pub page_size: Option<u32>,
    pub page_count: Option<u32>,
    pub tables: Vec<SqliteTablePreview>,
    pub truncated_tables: bool,
    pub max_tables: usize,
    pub max_rows_per_table: usize,
    pub max_columns_per_table: usize,
    pub max_cell_chars: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteTablePreview {
    pub name: String,
    pub kind: String,
    pub columns: Vec<SqliteColumnPreview>,
    pub rows: Vec<Vec<String>>,
    pub truncated_rows: bool,
    pub truncated_columns: bool,
    pub sample_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteColumnPreview {
    pub name: String,
    pub data_type: String,
    pub not_null: bool,
    pub primary_key: bool,
}

struct SqliteObject {
    name: String,
    kind: String,
}

pub async fn preview_sqlite_database(path: String) -> Result<SqliteDatabasePreview, String> {
    tokio::task::spawn_blocking(move || preview_sqlite_database_for_path(Path::new(&path)))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
pub(crate) fn preview_sqlite_database_for_test(
    path: &Path,
) -> Result<SqliteDatabasePreview, String> {
    preview_sqlite_database_for_path(path)
}

fn preview_sqlite_database_for_path(path: &Path) -> Result<SqliteDatabasePreview, String> {
    let path = super::preview::validate_preview_read_path(path)?;
    let file_size = fs::metadata(&path)
        .map_err(|error| error.to_string())?
        .len();
    let connection = Connection::open_with_flags(
        &path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|error| format!("SQLite 데이터베이스를 열 수 없습니다: {error}"))?;

    connection
        .busy_timeout(Duration::from_millis(250))
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "query_only", "ON")
        .map_err(|error| error.to_string())?;

    let mut objects = load_schema_objects(&connection)?;
    let truncated_tables = objects.len() > MAX_TABLES;
    objects.truncate(MAX_TABLES);

    let tables = objects
        .into_iter()
        .map(|object| preview_table(&connection, object))
        .collect::<Vec<_>>();

    Ok(SqliteDatabasePreview {
        file_size,
        page_size: query_pragma_u32(&connection, "page_size"),
        page_count: query_pragma_u32(&connection, "page_count"),
        tables,
        truncated_tables,
        max_tables: MAX_TABLES,
        max_rows_per_table: MAX_ROWS_PER_TABLE,
        max_columns_per_table: MAX_COLUMNS_PER_TABLE,
        max_cell_chars: MAX_CELL_CHARS,
    })
}

fn load_schema_objects(connection: &Connection) -> Result<Vec<SqliteObject>, String> {
    let mut statement = connection
        .prepare(
            "SELECT name, type
             FROM sqlite_schema
             WHERE type IN ('table', 'view')
               AND name NOT LIKE 'sqlite_%'
             ORDER BY type, name
             LIMIT ?1",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([(MAX_TABLES + 1) as i64], |row| {
            Ok(SqliteObject {
                name: row.get(0)?,
                kind: row.get(1)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut objects = Vec::new();
    for row in rows {
        objects.push(row.map_err(|error| error.to_string())?);
    }
    Ok(objects)
}

fn preview_table(connection: &Connection, object: SqliteObject) -> SqliteTablePreview {
    match load_table_columns(connection, &object.name) {
        Ok(columns) => {
            let truncated_columns = columns.len() > MAX_COLUMNS_PER_TABLE;
            let (rows, truncated_rows, sample_error) =
                match load_sample_rows(connection, &object.name, &columns) {
                    Ok((rows, truncated_rows)) => (rows, truncated_rows, None),
                    Err(error) => (Vec::new(), false, Some(error)),
                };

            SqliteTablePreview {
                name: object.name,
                kind: object.kind,
                columns: columns.into_iter().take(MAX_COLUMNS_PER_TABLE).collect(),
                rows,
                truncated_rows,
                truncated_columns,
                sample_error,
            }
        }
        Err(error) => SqliteTablePreview {
            name: object.name,
            kind: object.kind,
            columns: Vec::new(),
            rows: Vec::new(),
            truncated_rows: false,
            truncated_columns: false,
            sample_error: Some(error),
        },
    }
}

fn load_table_columns(
    connection: &Connection,
    table_name: &str,
) -> Result<Vec<SqliteColumnPreview>, String> {
    let sql = format!("PRAGMA table_info({})", quote_identifier(table_name));
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("컬럼 정보를 읽을 수 없습니다: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(SqliteColumnPreview {
                name: row.get(1)?,
                data_type: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                not_null: row.get::<_, i64>(3)? != 0,
                primary_key: row.get::<_, i64>(5)? != 0,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut columns = Vec::new();
    for row in rows {
        columns.push(row.map_err(|error| error.to_string())?);
    }
    Ok(columns)
}

fn load_sample_rows(
    connection: &Connection,
    table_name: &str,
    columns: &[SqliteColumnPreview],
) -> Result<(Vec<Vec<String>>, bool), String> {
    let select_list = if columns.is_empty() {
        "*".to_string()
    } else {
        columns
            .iter()
            .take(MAX_COLUMNS_PER_TABLE)
            .map(|column| quote_identifier(&column.name))
            .collect::<Vec<_>>()
            .join(", ")
    };

    let sql = format!(
        "SELECT {select_list} FROM {} LIMIT {}",
        quote_identifier(table_name),
        MAX_ROWS_PER_TABLE + 1
    );
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("샘플 행을 읽을 수 없습니다: {error}"))?;
    let column_count = statement.column_count();
    let rows = statement
        .query_map([], |row| {
            let mut values = Vec::with_capacity(column_count);
            for index in 0..column_count {
                values.push(format_sqlite_value(row.get_ref(index)?, MAX_CELL_CHARS));
            }
            Ok(values)
        })
        .map_err(|error| error.to_string())?;

    let mut sample_rows = Vec::new();
    for row in rows {
        sample_rows.push(row.map_err(|error| error.to_string())?);
    }

    let truncated_rows = sample_rows.len() > MAX_ROWS_PER_TABLE;
    sample_rows.truncate(MAX_ROWS_PER_TABLE);

    Ok((sample_rows, truncated_rows))
}

fn query_pragma_u32(connection: &Connection, name: &str) -> Option<u32> {
    connection
        .query_row(&format!("PRAGMA {name}"), [], |row| row.get::<_, i64>(0))
        .ok()
        .and_then(|value| u32::try_from(value).ok())
}

fn quote_identifier(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn format_sqlite_value(value: ValueRef<'_>, max_chars: usize) -> String {
    match value {
        ValueRef::Null => "NULL".to_string(),
        ValueRef::Integer(value) => value.to_string(),
        ValueRef::Real(value) => value.to_string(),
        ValueRef::Text(value) => truncate_text(&String::from_utf8_lossy(value), max_chars),
        ValueRef::Blob(value) => format!("<BLOB {} bytes>", value.len()),
    }
}

fn truncate_text(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let truncated = chars.by_ref().take(max_chars).collect::<String>();

    if chars.next().is_some() {
        format!("{truncated}...")
    } else {
        value.to_string()
    }
}
