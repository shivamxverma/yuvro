import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import pg from "pg";
import mysql from "mysql2/promise";
import { BASE_DIR } from "../../config";
import { DbConnection } from "./db-types";
import ApiError from "../../utils/ApiError";

const CONFIG_DIR = path.join(BASE_DIR, ".yuvro");
const CONFIG_PATH = path.join(CONFIG_DIR, "db_connections.json");

export function loadConnections(): DbConnection[] {
  if (!fs.existsSync(CONFIG_PATH)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    return data.connections || [];
  } catch {
    return [];
  }
}

export function saveConnections(connections: DbConnection[]): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ connections }, null, 2), "utf-8");
  } catch (error) {
    console.error("[db_service] Error saving connection config:", error);
  }
}

export function discoverDatabases(): string[] {
  const ignoreDirs = new Set([".venv", "venv", ".git", "node_modules", "__pycache__", ".pytest_cache"]);
  const dbFiles: string[] = [];

  function walk(currentDir: string) {
    const list = fs.readdirSync(currentDir);
    for (const item of list) {
      if (ignoreDirs.has(item)) continue;
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (ext === ".db" || ext === ".sqlite" || ext === ".sqlite3") {
          const relPath = path.relative(BASE_DIR, fullPath);
          dbFiles.push(relPath);
        }
      }
    }
  }

  if (fs.existsSync(BASE_DIR)) {
    walk(BASE_DIR);
  }
  return dbFiles.sort();
}

export function getAllConnections(): DbConnection[] {
  const discovered = discoverDatabases();
  const conns: DbConnection[] = [];

  for (const dbPath of discovered) {
    conns.push({
      id: dbPath,
      name: `SQLite: ${dbPath}`,
      type: "sqlite",
      path: dbPath,
    });
  }

  conns.push(...loadConnections());
  return conns;
}

// ─── Query Protection Validators ─────────────────────────────────────────────
const READONLY_START_KEYWORDS = new Set(["select", "with", "show", "describe", "desc", "pragma", "explain", "values"]);
const DANGEROUS_KEYWORDS = new Set(["insert", "update", "delete", "drop", "create", "alter", "replace", "truncate", "merge"]);

function normalizeQuery(query: string): string {
  let normalized = query.trim();
  while (normalized.startsWith("--") || normalized.startsWith("/*")) {
    if (normalized.startsWith("--")) {
      const newline = normalized.indexOf("\n");
      normalized = newline === -1 ? "" : normalized.substring(newline + 1).trim();
      continue;
    }
    if (normalized.startsWith("/*")) {
      const end = normalized.indexOf("*/");
      if (end === -1) {
        throw new ApiError("Unterminated SQL comment.", 400);
      }
      normalized = normalized.substring(end + 2).trim();
    }
  }
  return normalized;
}

export function validateReadonlyQuery(query: string): void {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    throw new ApiError("Query cannot be empty.", 400);
  }

  let trimmed = normalized.trim();
  if (trimmed.endsWith(";")) {
    trimmed = trimmed.substring(0, trimmed.length - 1).trim();
  }
  if (trimmed.includes(";")) {
    throw new ApiError("Only a single read-only statement is allowed.", 400);
  }

  const firstWordMatch = trimmed.match(/^([a-zA-Z]+)/);
  const firstWord = firstWordMatch ? firstWordMatch[1].toLowerCase() : "";
  if (!READONLY_START_KEYWORDS.has(firstWord)) {
    throw new ApiError(`Only read-only queries are allowed. Received '${firstWord || "unknown"}'.`, 400);
  }

  const wordPattern = new RegExp(`\\b(${Array.from(DANGEROUS_KEYWORDS).join("|")})\\b`, "i");
  const dangerousMatch = trimmed.match(wordPattern);
  if (dangerousMatch) {
    throw new ApiError(
      `Write operation '${dangerousMatch[1].toUpperCase()}' is not allowed in this read-only viewer.`,
      400
    );
  }
}

// ─── Database Adapters ────────────────────────────────────────────────────────
export interface BaseDbAdapter {
  getTablesWithCounts(): Promise<Array<{ name: string; rowCount: number }>>;
  getTableSchema(tableName: string): Promise<any[]>;
  getTableRows(tableName: string, page: number, pageSize: number): Promise<{ rows: any[]; columns: string[]; total: number }>;
  runCustomQuery(query: string): Promise<{ results: any[]; columns: string[] }>;
}

export class SQLiteAdapter implements BaseDbAdapter {
  private absPath: string;

  constructor(relativePath: string) {
    const cleanPath = relativePath.replace(/^\//, "");
    this.absPath = path.resolve(BASE_DIR, cleanPath);
    if (!this.absPath.startsWith(path.resolve(BASE_DIR))) {
      throw new ApiError("Access denied: path is outside workspace directory.", 403);
    }
    if (!fs.existsSync(this.absPath)) {
      throw new ApiError(`Database file not found: ${relativePath}`, 404);
    }
  }

  private getDatabaseConnection(): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.absPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) return reject(err);
        resolve(db);
      });
    });
  }

  public async getTablesWithCounts(): Promise<Array<{ name: string; rowCount: number }>> {
    const db = await this.getDatabaseConnection();
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
        async (err, rows: any[]) => {
          if (err) {
            db.close();
            return reject(err);
          }
          
          const tables: Array<{ name: string; rowCount: number }> = [];
          
          try {
            for (const row of rows) {
              const tableName = row.name;
              const count: any = await new Promise((res) => {
                db.get(`SELECT count(*) as cnt FROM "${tableName}"`, (countErr, countRow: any) => {
                  res(countRow ? countRow.cnt : 0);
                });
              });
              tables.push({ name: tableName, rowCount: count });
            }
            resolve(tables.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())));
          } catch (e) {
            reject(e);
          } finally {
            db.close();
          }
        }
      );
    });
  }

  public async getTableSchema(tableName: string): Promise<any[]> {
    const db = await this.getDatabaseConnection();
    return new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info("${tableName}")`, (err, rows: any[]) => {
        db.close();
        if (err) return reject(err);
        
        resolve(
          rows.map((r) => ({
            cid: r.cid,
            name: r.name,
            type: r.type,
            notnull: r.notnull === 1,
            dflt_value: r.dflt_value,
            pk: r.pk === 1,
          }))
        );
      });
    });
  }

  public async getTableRows(
    tableName: string,
    page: number,
    pageSize: number
  ): Promise<{ rows: any[]; columns: string[]; total: number }> {
    const db = await this.getDatabaseConnection();
    return new Promise((resolve, reject) => {
      db.get(`SELECT count(*) as total FROM "${tableName}"`, (err, countRow: any) => {
        if (err) {
          db.close();
          return reject(err);
        }
        const total = countRow ? countRow.total : 0;
        const offset = (page - 1) * pageSize;

        db.all(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`, [pageSize, offset], (selectErr, rows: any[]) => {
          db.close();
          if (selectErr) return reject(selectErr);
          
          const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
          resolve({ rows, columns, total });
        });
      });
    });
  }

  public async runCustomQuery(query: string): Promise<{ results: any[]; columns: string[] }> {
    validateReadonlyQuery(query);
    const db = await this.getDatabaseConnection();
    return new Promise((resolve, reject) => {
      db.all(query, (err, rows: any[]) => {
        db.close();
        if (err) return reject(err);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        resolve({ results: rows, columns });
      });
    });
  }
}

export class PostgresAdapter implements BaseDbAdapter {
  private config: DbConnection;

  constructor(connConfig: DbConnection) {
    this.config = connConfig;
  }

  private async getClient(): Promise<pg.Client> {
    const client = new pg.Client({
      host: this.config.host || "localhost",
      port: this.config.port || 5432,
      user: this.config.user || "postgres",
      password: this.config.password || "",
      database: this.config.database || "postgres",
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    // Enforce read-only transaction mode
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
    return client;
  }

  public async getTablesWithCounts(): Promise<Array<{ name: string; rowCount: number }>> {
    const client = await this.getClient();
    try {
      const res = await client.query(`
        SELECT table_name as name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
      `);
      
      const tables: Array<{ name: string; rowCount: number }> = [];
      for (const row of res.rows) {
        const name = row.name;
        let count = 0;
        try {
          const countRes = await client.query(`SELECT count(*) as cnt FROM "${name}"`);
          count = parseInt(countRes.rows[0].cnt, 10);
        } catch {
          // Ignore count error
        }
        tables.push({ name, rowCount: count });
      }
      return tables.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    } finally {
      await client.end();
    }
  }

  public async getTableSchema(tableName: string): Promise<any[]> {
    const client = await this.getClient();
    try {
      const res = await client.query(`
        SELECT 
            ordinal_position as cid,
            column_name as name,
            data_type as type,
            is_nullable = 'NO' as notnull,
            column_default as dflt_value,
            column_name IN (
                SELECT kcu.column_name 
                FROM information_schema.table_constraints tc 
                JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
            ) as pk
        FROM information_schema.columns
        WHERE table_name = $2
        ORDER BY ordinal_position;
      `, [tableName, tableName]);

      return res.rows.map((r) => ({
        cid: r.cid,
        name: r.name,
        type: r.type,
        notnull: r.notnull,
        dflt_value: r.dflt_value,
        pk: r.pk,
      }));
    } finally {
      await client.end();
    }
  }

  public async getTableRows(
    tableName: string,
    page: number,
    pageSize: number
  ): Promise<{ rows: any[]; columns: string[]; total: number }> {
    const client = await this.getClient();
    try {
      const countRes = await client.query(`SELECT count(*) as total FROM "${tableName}"`);
      const total = parseInt(countRes.rows[0].total, 10);

      const offset = (page - 1) * pageSize;
      const selectRes = await client.query(`SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`, [pageSize, offset]);
      
      const columns = selectRes.fields.map((f) => f.name);
      return { rows: selectRes.rows, columns, total };
    } finally {
      await client.end();
    }
  }

  public async runCustomQuery(query: string): Promise<{ results: any[]; columns: string[] }> {
    validateReadonlyQuery(query);
    const client = await this.getClient();
    try {
      const res = await client.query(query);
      const columns = res.fields ? res.fields.map((f) => f.name) : [];
      return { results: res.rows, columns };
    } finally {
      await client.end();
    }
  }
}

export class MySQLAdapter implements BaseDbAdapter {
  private config: DbConnection;

  constructor(connConfig: DbConnection) {
    this.config = connConfig;
  }

  private async getConnection(): Promise<mysql.Connection> {
    const connection = await mysql.createConnection({
      host: this.config.host || "localhost",
      port: this.config.port || 3306,
      user: this.config.user || "root",
      password: this.config.password || "",
      database: this.config.database || "",
      connectTimeout: 5000,
    });
    // Set read-only session
    await connection.query("SET TRANSACTION READ ONLY");
    return connection;
  }

  public async getTablesWithCounts(): Promise<Array<{ name: string; rowCount: number }>> {
    const conn = await this.getConnection();
    try {
      const [rows]: any = await conn.query("SHOW TABLES;");
      const tables: Array<{ name: string; rowCount: number }> = [];

      for (const row of rows) {
        const name = Object.values(row)[0] as string;
        let count = 0;
        try {
          const [countRows]: any = await conn.query(`SELECT count(*) as cnt FROM \`${name}\``);
          count = countRows[0] ? parseInt(countRows[0].cnt, 10) : 0;
        } catch {
          // Ignore count error
        }
        tables.push({ name, rowCount: count });
      }

      return tables.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    } finally {
      await conn.end();
    }
  }

  public async getTableSchema(tableName: string): Promise<any[]> {
    const conn = await this.getConnection();
    try {
      const [rows]: any = await conn.query(`DESCRIBE \`${tableName}\``);
      return rows.map((r: any, i: number) => ({
        cid: i,
        name: r.Field,
        type: r.Type,
        notnull: r.Null === "NO",
        dflt_value: r.Default,
        pk: r.Key === "PRI",
      }));
    } finally {
      await conn.end();
    }
  }

  public async getTableRows(
    tableName: string,
    page: number,
    pageSize: number
  ): Promise<{ rows: any[]; columns: string[]; total: number }> {
    const conn = await this.getConnection();
    try {
      const [countRows]: any = await conn.query(`SELECT count(*) as total FROM \`${tableName}\``);
      const total = countRows[0] ? parseInt(countRows[0].total, 10) : 0;

      const offset = (page - 1) * pageSize;
      const [rows, fields]: any = await conn.query(`SELECT * FROM \`${tableName}\` LIMIT ?, ?`, [offset, pageSize]);
      
      const columns = fields ? fields.map((f: any) => f.name) : [];
      return { rows, columns, total };
    } finally {
      await conn.end();
    }
  }

  public async runCustomQuery(query: string): Promise<{ results: any[]; columns: string[] }> {
    validateReadonlyQuery(query);
    const conn = await this.getConnection();
    try {
      const [rows, fields]: any = await conn.query(query);
      const columns = fields ? fields.map((f: any) => f.name) : [];
      return { results: rows, columns };
    } finally {
      await conn.end();
    }
  }
}

// ─── Adapter Registry Factory ─────────────────────────────────────────────────
export function getAdapterForConnection(connectionId: string): BaseDbAdapter {
  if (
    connectionId.endsWith(".db") ||
    connectionId.endsWith(".sqlite") ||
    connectionId.endsWith(".sqlite3")
  ) {
    return new SQLiteAdapter(connectionId);
  }

  const saved = loadConnections();
  for (const conn of saved) {
    if (conn.id === connectionId) {
      if (conn.type === "postgres") {
        return new PostgresAdapter(conn);
      } else if (conn.type === "mysql") {
        return new MySQLAdapter(conn);
      } else if (conn.type === "sqlite") {
        return new SQLiteAdapter(conn.path || "");
      }
    }
  }

  // Fallback
  try {
    return new SQLiteAdapter(connectionId);
  } catch {
    throw new ApiError(`Database connection profile '${connectionId}' not found.`, 404);
  }
}
