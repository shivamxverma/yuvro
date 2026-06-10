from fastapi import APIRouter, Response
from pydantic import BaseModel
from typing import Optional
from app.controllers import db_controller

router = APIRouter(prefix="/api/db", tags=["database"])

class ConnectionPayload(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    type: str  # "postgres", "mysql", "sqlite"
    host: Optional[str] = None
    port: Optional[int] = None
    user: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    path: Optional[str] = None

class QueryPayload(BaseModel):
    db_path: str  # maps to connection_id
    query: str

@router.get("/list")
@router.get("/connections")
async def list_connections_route():
    try:
        return await db_controller.list_databases()
    except Exception as e:
        return Response(content=str(e), status_code=500)

@router.post("/connections")
async def save_connection_route(payload: ConnectionPayload):
    try:
        return await db_controller.save_connection(payload.dict())
    except Exception as e:
        return Response(content=str(e), status_code=500)

@router.delete("/connections/{conn_id}")
async def delete_connection_route(conn_id: str):
    try:
        return await db_controller.delete_connection(conn_id)
    except Exception as e:
        return Response(content=str(e), status_code=500)

@router.get("/tables")
async def list_db_tables(db_path: str):
    try:
        return await db_controller.list_tables(db_path)
    except Exception as e:
        return Response(content=str(e), status_code=500)

@router.get("/schema")
async def get_db_table_schema(db_path: str, table: str):
    try:
        return await db_controller.get_schema(db_path, table)
    except Exception as e:
        return Response(content=str(e), status_code=500)

@router.get("/rows")
async def get_db_table_rows(db_path: str, table: str, page: int = 1, page_size: int = 50):
    try:
        return await db_controller.get_rows(db_path, table, page, page_size)
    except Exception as e:
        return Response(content=str(e), status_code=500)

@router.post("/query")
async def run_db_query(payload: QueryPayload):
    try:
        return await db_controller.run_query(payload.db_path, payload.query)
    except Exception as e:
        return Response(content=str(e), status_code=400)
