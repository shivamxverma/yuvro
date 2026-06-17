import os
import sqlite3
import json
import re
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple
from app.core.config import BASE_DIR

# ─── Connection Profile Persistence Helpers ────────────────────────────────────
CONFIG_DIR = os.path.join(BASE_DIR, ".yuvro")
CONFIG_PATH = os.path.join(CONFIG_DIR, "db_connections.json")

def load_connections() -> List[Dict[str, Any]]:
    if not os.path.exists(CONFIG_PATH):
        return []
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("connections", [])
    except Exception:
        return []

def save_connections(connections: List[Dict[str, Any]]) -> None:
    os.makedirs(CONFIG_DIR, exist_ok=True)
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump({"connections": connections}, f, indent=2)
    except Exception as e:
        print(f"[db_service] Error saving connection config: {e}")

# ─── SQLite Discoverer ─────────────────────────────────────────────────────────
def discover_databases() -> List[str]:
    """Recursively search BASE_DIR for SQLite files, ignoring common system/dependency dirs."""
    ignore_dirs = {".venv", "venv", ".git", "node_modules", "__pycache__", ".pytest_cache"}
    db_files = []
    
    for root, dirs, files in os.walk(BASE_DIR):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in {".db", ".sqlite", ".sqlite3"}:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, BASE_DIR)
                db_files.append(rel_path)
                
    return sorted(db_files)

def get_all_connections() -> List[Dict[str, Any]]:
    """Get discovered SQLite files and manually configured connections in one catalog."""
    discovered = discover_databases()
    conns = []
    
    # 1. Add SQLite files
    for db_path in discovered:
        conns.append({
            "id": db_path,
            "name": f"SQLite: {db_path}",
            "type": "sqlite",
            "path": db_path
        })
        
    # 2. Add saved remote databases
    conns.extend(load_connections())
    return conns

# ─── Abstract Database Adapter ───────────────────────────────────────────────
class BaseDbAdapter(ABC):
    READONLY_START_KEYWORDS = {"select", "with", "show", "describe", "desc", "pragma", "explain", "values"}
    DANGEROUS_KEYWORDS = {"insert", "update", "delete", "drop", "create", "alter", "replace", "truncate", "merge"}

    @abstractmethod
    def get_tables_with_counts(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_table_rows(self, table_name: str, page: int, page_size: int) -> Tuple[List[Dict[str, Any]], List[str], int]:
        pass

    @abstractmethod
    def run_custom_query(self, query: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        pass

    def _normalize_query(self, query: str) -> str:
        normalized = query.strip()
        while normalized.startswith("--") or normalized.startswith("/*"):
            if normalized.startswith("--"):
                newline = normalized.find("\n")
                normalized = "" if newline == -1 else normalized[newline + 1 :].lstrip()
                continue
            if normalized.startswith("/*"):
                end = normalized.find("*/")
                if end == -1:
                    raise ValueError("Unterminated SQL comment.")
                normalized = normalized[end + 2 :].lstrip()
        return normalized

    def _validate_readonly_query(self, query: str) -> None:
        """Enforce read-only access for custom queries."""
        normalized = self._normalize_query(query)
        if not normalized:
            raise ValueError("Query cannot be empty.")

        trimmed = normalized.rstrip()
        if trimmed.endswith(";"):
            trimmed = trimmed[:-1].rstrip()
        if ";" in trimmed:
            raise ValueError("Only a single read-only statement is allowed.")

        first_word_match = re.match(r"([a-zA-Z]+)", trimmed)
        first_word = first_word_match.group(1).lower() if first_word_match else ""
        if first_word not in self.READONLY_START_KEYWORDS:
            raise ValueError(f"Only read-only queries are allowed. Received '{first_word or 'unknown'}'.")

        dangerous_pattern = r"\b(" + "|".join(sorted(self.DANGEROUS_KEYWORDS)) + r")\b"
        dangerous_match = re.search(dangerous_pattern, trimmed, flags=re.IGNORECASE)
        if dangerous_match:
            raise ValueError(
                f"Write operation '{dangerous_match.group(1).upper()}' is not allowed in this read-only viewer."
            )

# ─── SQLite Adapter ──────────────────────────────────────────────────────────
class SQLiteAdapter(BaseDbAdapter):
    def __init__(self, relative_path: str):
        relative_path = relative_path.lstrip("/")
        self.abs_path = os.path.abspath(os.path.join(BASE_DIR, relative_path))
        if not self.abs_path.startswith(os.path.abspath(BASE_DIR)):
            raise ValueError("Access denied: path is outside workspace directory.")
        if not os.path.exists(self.abs_path):
            raise FileNotFoundError(f"Database file not found: {relative_path}")

    def _get_connection(self):
        conn = sqlite3.connect(self.abs_path)
        conn.execute("PRAGMA query_only = ON")
        return conn

    def get_tables_with_counts(self) -> List[Dict[str, Any]]:
        tables = []
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            table_names = [row["name"] for row in cursor.fetchall()]
            
            for table in table_names:
                try:
                    cursor.execute(f'SELECT count(*) as cnt FROM "{table}"')
                    count_row = cursor.fetchone()
                    row_count = count_row["cnt"] if count_row else 0
                except Exception:
                    row_count = 0
                tables.append({"name": table, "rowCount": row_count})
        finally:
            conn.close()
        return sorted(tables, key=lambda x: x["name"].lower())

    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        columns = []
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute(f'PRAGMA table_info("{table_name}")')
            rows = cursor.fetchall()
            for r in rows:
                columns.append({
                    "cid": r["cid"],
                    "name": r["name"],
                    "type": r["type"],
                    "notnull": bool(r["notnull"]),
                    "dflt_value": r["dflt_value"],
                    "pk": bool(r["pk"])
                })
        finally:
            conn.close()
        return columns

    def get_table_rows(self, table_name: str, page: int, page_size: int) -> Tuple[List[Dict[str, Any]], List[str], int]:
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(f'SELECT count(*) FROM "{table_name}"')
            total_rows = cursor.fetchone()[0]
            
            offset = (page - 1) * page_size
            cursor.execute(f'SELECT * FROM "{table_name}" LIMIT ? OFFSET ?', (page_size, offset))
            
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = []
            for r in cursor.fetchall():
                rows.append(dict(zip(columns, r)))
        finally:
            conn.close()
        return rows, columns, total_rows

    def run_custom_query(self, query: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        self._validate_readonly_query(query)
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(query)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            results = []
            rows = cursor.fetchmany(200)
            for r in rows:
                results.append(dict(zip(columns, r)))
        finally:
            conn.close()
        return results, columns

# ─── Postgres Adapter ─────────────────────────────────────────────────────────
class PostgresAdapter(BaseDbAdapter):
    def __init__(self, config: dict):
        self.config = config

    def _get_connection(self):
        import psycopg2
        conn = psycopg2.connect(
            host=self.config.get("host", "localhost"),
            port=int(self.config.get("port", 5432)),
            user=self.config.get("user", "postgres"),
            password=self.config.get("password", ""),
            dbname=self.config.get("database", "postgres"),
            connect_timeout=5
        )
        conn.set_session(readonly=True, autocommit=False)
        return conn

    def get_tables_with_counts(self) -> List[Dict[str, Any]]:
        import psycopg2.extras
        tables = []
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            cursor.execute("""
                SELECT table_name as name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
            """)
            rows = cursor.fetchall()
            for r in rows:
                name = r["name"]
                try:
                    cursor.execute(f'SELECT count(*) as cnt FROM "{name}"')
                    cnt = cursor.fetchone()["cnt"]
                except Exception:
                    cnt = 0
                tables.append({"name": name, "rowCount": cnt})
        finally:
            conn.close()
        return sorted(tables, key=lambda x: x["name"].lower())

    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        import psycopg2.extras
        columns = []
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            # Check constraints to find Primary Keys
            cursor.execute("""
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
                        WHERE tc.table_name = %s AND tc.constraint_type = 'PRIMARY KEY'
                    ) as pk
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position;
            """, (table_name, table_name))
            rows = cursor.fetchall()
            for r in rows:
                columns.append({
                    "cid": r["cid"],
                    "name": r["name"],
                    "type": r["type"],
                    "notnull": r["notnull"],
                    "dflt_value": r["dflt_value"],
                    "pk": r["pk"]
                })
        finally:
            conn.close()
        return columns

    def get_table_rows(self, table_name: str, page: int, page_size: int) -> Tuple[List[Dict[str, Any]], List[str], int]:
        import psycopg2.extras
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            cursor.execute(f'SELECT count(*) as total FROM "{table_name}"')
            total_rows = cursor.fetchone()["total"]
            
            offset = (page - 1) * page_size
            cursor.execute(f'SELECT * FROM "{table_name}" LIMIT %s OFFSET %s', (page_size, offset))
            
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()
        return rows, columns, total_rows

    def run_custom_query(self, query: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        self._validate_readonly_query(query)
        import psycopg2.extras
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            cursor.execute(query)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            results = []
            if cursor.description:
                results = [dict(r) for r in cursor.fetchmany(200)]
        finally:
            conn.close()
        return results, columns

# ─── MySQL Adapter ───────────────────────────────────────────────────────────
class MySQLAdapter(BaseDbAdapter):
    def __init__(self, config: dict):
        self.config = config

    def _get_connection(self):
        import pymysql
        conn = pymysql.connect(
            host=self.config.get("host", "localhost"),
            port=int(self.config.get("port", 3306)),
            user=self.config.get("user", "root"),
            password=self.config.get("password", ""),
            database=self.config.get("database", ""),
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=5,
            autocommit=False,
        )
        with conn.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
        return conn

    def get_tables_with_counts(self) -> List[Dict[str, Any]]:
        tables = []
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SHOW TABLES;")
                rows = cursor.fetchall()
                for r in rows:
                    name = list(r.values())[0]
                    try:
                        cursor.execute(f"SELECT count(*) as cnt FROM `{name}`")
                        cnt = cursor.fetchone()["cnt"]
                    except Exception:
                        cnt = 0
                    tables.append({"name": name, "rowCount": cnt})
        finally:
            conn.close()
        return sorted(tables, key=lambda x: x["name"].lower())

    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        columns = []
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"DESCRIBE `{table_name}`")
                rows = cursor.fetchall()
                for i, r in enumerate(rows):
                    columns.append({
                        "cid": i,
                        "name": r["Field"],
                        "type": r["Type"],
                        "notnull": r["Null"] == "NO",
                        "dflt_value": r["Default"],
                        "pk": r["Key"] == "PRI"
                    })
        finally:
            conn.close()
        return columns

    def get_table_rows(self, table_name: str, page: int, page_size: int) -> Tuple[List[Dict[str, Any]], List[str], int]:
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"SELECT count(*) as total FROM `{table_name}`")
                total_rows = cursor.fetchone()["total"]
                
                offset = (page - 1) * page_size
                cursor.execute(f"SELECT * FROM `{table_name}` LIMIT %s, %s", (offset, page_size))
                
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                rows = [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()
        return rows, columns, total_rows

    def run_custom_query(self, query: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        self._validate_readonly_query(query)
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query)
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                results = []
                if cursor.description:
                    results = [dict(r) for r in cursor.fetchmany(200)]
        finally:
            conn.close()
        return results, columns

# ─── Adapter Registry Factory ─────────────────────────────────────────────────
def get_adapter_for_connection(connection_id: str) -> BaseDbAdapter:
    """Instantiate and return the appropriate DB adapter for a connection ID."""
    # 1. Direct SQLite file connection fallback
    if connection_id.endswith((".db", ".sqlite", ".sqlite3")):
        return SQLiteAdapter(connection_id)
        
    # 2. Check saved configurations
    saved = load_connections()
    for conn in saved:
        if conn.get("id") == connection_id:
            conn_type = conn.get("type", "").lower()
            if conn_type == "postgres":
                return PostgresAdapter(conn)
            elif conn_type == "mysql":
                return MySQLAdapter(conn)
            elif conn_type == "sqlite":
                return SQLiteAdapter(conn.get("path", ""))

    # 3. Last resort fallback
    try:
        return SQLiteAdapter(connection_id)
    except Exception:
        raise ValueError(f"Database connection profile '{connection_id}' not found.")
