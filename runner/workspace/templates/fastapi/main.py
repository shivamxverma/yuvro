import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row
from pydantic import BaseModel, Field


app = FastAPI(
    title="Yuvro Todo API",
    description="FastAPI todo starter that reads the Postgres connection saved by Yuvro's Database Viewer.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONNECTIONS_PATH = Path(".yuvro/db_connections.json")
CREATE_TODOS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS todos (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


class TodoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class Todo(BaseModel):
    id: int
    title: str
    created_at: datetime


def _load_saved_postgres_connection() -> dict[str, Any] | None:
    if not CONNECTIONS_PATH.exists():
        return None

    try:
        payload = json.loads(CONNECTIONS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    connections = payload.get("connections", [])
    if not isinstance(connections, list):
        return None

    preferred_name = os.getenv("YUVRO_DB_CONNECTION_NAME", "").strip().lower()
    postgres_connections = [
        connection
        for connection in connections
        if isinstance(connection, dict) and connection.get("type") == "postgres"
    ]
    if not postgres_connections:
        return None

    if preferred_name:
        for connection in postgres_connections:
            if str(connection.get("name", "")).strip().lower() == preferred_name:
                return connection

    return postgres_connections[0]


def _resolve_connection_config() -> tuple[str, dict[str, Any]]:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return "DATABASE_URL", {"conninfo": database_url}

    host = os.getenv("POSTGRES_HOST", "").strip()
    user = os.getenv("POSTGRES_USER", "").strip()
    password = os.getenv("POSTGRES_PASSWORD", "").strip()
    database = os.getenv("POSTGRES_DB", "").strip()
    if host and user and password and database:
        return "environment variables", {
            "host": host,
            "port": int(os.getenv("POSTGRES_PORT", "5432")),
            "user": user,
            "password": password,
            "dbname": database,
        }

    saved_connection = _load_saved_postgres_connection()
    if saved_connection:
        return "Database Viewer profile", {
            "host": str(saved_connection.get("host", "")).strip(),
            "port": int(saved_connection.get("port", 5432)),
            "user": str(saved_connection.get("user", "postgres")).strip(),
            "password": str(saved_connection.get("password", "")).strip(),
            "dbname": str(saved_connection.get("database", "yuvro_db")).strip(),
        }

    raise HTTPException(
        status_code=503,
        detail=(
            "Postgres connection not configured. Open Yuvro's Database Viewer, provision a Postgres "
            "database, save the connection, then restart the API."
        ),
    )


def _connect() -> tuple[str, psycopg.Connection]:
    source, config = _resolve_connection_config()

    try:
        if "conninfo" in config:
            connection = psycopg.connect(config["conninfo"], row_factory=dict_row)
        else:
            connection = psycopg.connect(row_factory=dict_row, **config)
    except psycopg.Error as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Postgres from {source}: {exc}",
        ) from exc

    return source, connection


def _ensure_schema(connection: psycopg.Connection) -> None:
    connection.execute(CREATE_TODOS_TABLE_SQL)
    connection.commit()


def _normalize_title(title: str) -> str:
    normalized = title.strip()
    if not normalized:
        raise HTTPException(status_code=422, detail="Todo title cannot be empty.")
    return normalized


@app.get("/")
def read_root() -> dict[str, Any]:
    try:
        source, _ = _resolve_connection_config()
    except HTTPException:
        source = "not configured yet"
    return {
        "message": "Yuvro FastAPI todo starter is ready.",
        "databaseSource": source,
        "routes": {
            "createTodo": "POST /todo",
            "latestTodo": "GET /todo",
            "todoById": "GET /todo/{id}",
            "allTodos": "GET /all-todo",
        },
    }


@app.post("/todo", response_model=Todo)
def create_todo(payload: TodoCreate) -> dict[str, Any]:
    title = _normalize_title(payload.title)
    _, connection = _connect()

    try:
        _ensure_schema(connection)
        row = connection.execute(
            """
            INSERT INTO todos (title)
            VALUES (%s)
            RETURNING id, title, created_at
            """,
            (title,),
        ).fetchone()
        connection.commit()
        return dict(row)
    finally:
        connection.close()


@app.get("/todo", response_model=Todo)
def get_latest_todo() -> dict[str, Any]:
    _, connection = _connect()

    try:
        _ensure_schema(connection)
        row = connection.execute(
            """
            SELECT id, title, created_at
            FROM todos
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="No todos found.")
        return dict(row)
    finally:
        connection.close()


@app.get("/todo/{todo_id}", response_model=Todo)
def get_todo(todo_id: int) -> dict[str, Any]:
    _, connection = _connect()

    try:
        _ensure_schema(connection)
        row = connection.execute(
            """
            SELECT id, title, created_at
            FROM todos
            WHERE id = %s
            """,
            (todo_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Todo {todo_id} not found.")
        return dict(row)
    finally:
        connection.close()


@app.get("/all-todo", response_model=list[Todo])
def get_all_todos() -> list[dict[str, Any]]:
    _, connection = _connect()

    try:
        _ensure_schema(connection)
        rows = connection.execute(
            """
            SELECT id, title, created_at
            FROM todos
            ORDER BY id DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
