import asyncio
from app.services import db as db_service

async def list_databases():
    # Returns unified connection list (SQLite files + saved Postgres/MySQL DB connections)
    conns = await asyncio.to_thread(db_service.get_all_connections)
    return {"databases": conns}

async def save_connection(conn_data: dict):
    saved = await asyncio.to_thread(db_service.load_connections)
    # Generate unique ID if not present
    import uuid
    conn_id = conn_data.get("id") or str(uuid.uuid4())
    conn_data["id"] = conn_id
    
    # Pre-fill defaults
    if "name" not in conn_data or not conn_data["name"]:
        conn_data["name"] = f"{conn_data.get('type', 'DB').upper()}: {conn_data.get('database')}"
        
    # Replace existing connection if ID matches
    updated = [c for c in saved if c.get("id") != conn_id]
    updated.append(conn_data)
    
    await asyncio.to_thread(db_service.save_connections, updated)
    return {"status": "success", "connection": conn_data}

async def delete_connection(connection_id: str):
    saved = await asyncio.to_thread(db_service.load_connections)
    updated = [c for c in saved if c.get("id") != connection_id]
    await asyncio.to_thread(db_service.save_connections, updated)
    return {"status": "success"}

async def list_tables(connection_id: str):
    adapter = db_service.get_adapter_for_connection(connection_id)
    tables = await asyncio.to_thread(adapter.get_tables_with_counts)
    return {"tables": tables}

async def get_schema(connection_id: str, table: str):
    adapter = db_service.get_adapter_for_connection(connection_id)
    schema = await asyncio.to_thread(adapter.get_table_schema, table)
    return {"schema": schema}

async def get_rows(connection_id: str, table: str, page: int, page_size: int):
    adapter = db_service.get_adapter_for_connection(connection_id)
    rows, columns, total = await asyncio.to_thread(adapter.get_table_rows, table, page, page_size)
    return {"rows": rows, "columns": columns, "total": total, "page": page, "page_size": page_size}

async def run_query(connection_id: str, query: str):
    adapter = db_service.get_adapter_for_connection(connection_id)
    results, columns = await asyncio.to_thread(adapter.run_custom_query, query)
    return {"results": results, "columns": columns}
