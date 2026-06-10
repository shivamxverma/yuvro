from fastapi import APIRouter, Response
from pydantic import BaseModel
from app.controllers import db_controller

router = APIRouter(prefix="/api/db", tags=["database"])

class QueryPayload(BaseModel):
    db_path: str
    query: str

@router.get("/list")
async def list_dbs():
    try:
        return await db_controller.list_databases()
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
