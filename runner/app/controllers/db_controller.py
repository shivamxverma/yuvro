import asyncio
from app.services import db as db_service

async def list_databases():
    dbs = await asyncio.to_thread(db_service.discover_databases)
    return {"databases": dbs}

async def list_tables(db_path: str):
    tables = await asyncio.to_thread(db_service.get_tables_with_counts, db_path)
    return {"tables": tables}

async def get_schema(db_path: str, table: str):
    schema = await asyncio.to_thread(db_service.get_table_schema, db_path, table)
    return {"schema": schema}

async def get_rows(db_path: str, table: str, page: int, page_size: int):
    rows, columns, total = await asyncio.to_thread(db_service.get_table_rows, db_path, table, page, page_size)
    return {"rows": rows, "columns": columns, "total": total, "page": page, "page_size": page_size}

async def run_query(db_path: str, query: str):
    results, columns = await asyncio.to_thread(db_service.run_custom_query, db_path, query)
    return {"results": results, "columns": columns}
