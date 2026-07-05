export interface DbConnection {
  id: string;
  name: string;
  type: "postgres" | "mysql" | "sqlite";
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  path?: string;
}

export interface AddConnectionBody {
  id?: string;
  name?: string;
  type: "postgres" | "mysql" | "sqlite";
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  path?: string;
}

export interface TablesQuery {
  db_path: string;
}

export interface SchemaQuery {
  db_path: string;
  table: string;
}

export interface RowsQuery {
  db_path: string;
  table: string;
  page?: string;
  page_size?: string;
}

export interface RunQueryBody {
  db_path: string;
  query: string;
}
