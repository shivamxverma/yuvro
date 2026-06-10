import os
import sqlite3
from typing import List, Dict, Any, Tuple

# We import BASE_DIR from app.fs
from app.fs import BASE_DIR

def get_safe_db_path(relative_path: str) -> str:
    """Resolve and validate the DB path to ensure it is within BASE_DIR."""
    # Clean paths
    relative_path = relative_path.lstrip("/")
    abs_path = os.path.abspath(os.path.join(BASE_DIR, relative_path))
    
    if not abs_path.startswith(os.path.abspath(BASE_DIR)):
        raise ValueError("Access denied: path is outside workspace directory.")
    
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"Database file not found: {relative_path}")
        
    return abs_path

def discover_databases() -> List[str]:
    """Recursively search BASE_DIR for SQLite files, ignoring common system/dependency dirs."""
    ignore_dirs = {".venv", "venv", ".git", "node_modules", "__pycache__", ".pytest_cache"}
    db_files = []
    
    for root, dirs, files in os.walk(BASE_DIR):
        # Prune ignored directories in-place
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in {".db", ".sqlite", ".sqlite3"}:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, BASE_DIR)
                db_files.append(rel_path)
                
    return sorted(db_files)

def get_tables_with_counts(db_path: str) -> List[Dict[str, Any]]:
    """Get all tables and their row count in the given database."""
    abs_path = get_safe_db_path(db_path)
    tables = []
    
    conn = sqlite3.connect(abs_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Fetch tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        table_names = [row["name"] for row in cursor.fetchall()]
        
        for table in table_names:
            try:
                # Count rows in each table safely
                cursor.execute(f'SELECT count(*) as cnt FROM "{table}"')
                count_row = cursor.fetchone()
                row_count = count_row["cnt"] if count_row else 0
            except Exception:
                row_count = 0
            tables.append({"name": table, "rowCount": row_count})
            
    finally:
        conn.close()
        
    return sorted(tables, key=lambda x: x["name"].lower())

def get_table_schema(db_path: str, table_name: str) -> List[Dict[str, Any]]:
    """Retrieve column information (name, type, notnull, pk) for a table."""
    abs_path = get_safe_db_path(db_path)
    columns = []
    
    conn = sqlite3.connect(abs_path)
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

def get_table_rows(db_path: str, table_name: str, page: int = 1, page_size: int = 50) -> Tuple[List[Dict[str, Any]], List[str], int]:
    """Retrieve rows of a table with limit/offset pagination."""
    abs_path = get_safe_db_path(db_path)
    
    conn = sqlite3.connect(abs_path)
    cursor = conn.cursor()
    
    try:
        # Get total count
        cursor.execute(f'SELECT count(*) FROM "{table_name}"')
        total_rows = cursor.fetchone()[0]
        
        # Get page data
        offset = (page - 1) * page_size
        cursor.execute(f'SELECT * FROM "{table_name}" LIMIT ? OFFSET ?', (page_size, offset))
        
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = []
        for r in cursor.fetchall():
            rows.append(dict(zip(columns, r)))
            
    finally:
        conn.close()
        
    return rows, columns, total_rows

def run_custom_query(db_path: str, query: str, limit: int = 200) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Execute a custom SQL query in a read-only mode."""
    abs_path = get_safe_db_path(db_path)
    
    query_stripped = query.strip().lower()
    
    # Simple block of non-readonly commands
    dangerous_keywords = ["insert", "update", "delete", "drop", "create", "alter", "replace", "truncate"]
    first_word = query_stripped.split()[0] if query_stripped.split() else ""
    if first_word in dangerous_keywords:
        raise ValueError(f"Write operation '{first_word.upper()}' is not allowed in this read-only viewer.")
        
    conn = sqlite3.connect(abs_path)
    cursor = conn.cursor()
    
    try:
        # Execute query
        cursor.execute(query)
        
        # Check if cursor returned any metadata/results
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        
        # Fetch matching rows (limit to prevent memory exhaustion)
        results = []
        rows = cursor.fetchmany(limit)
        for r in rows:
            results.append(dict(zip(columns, r)))
            
    finally:
        conn.close()
        
    return results, columns
