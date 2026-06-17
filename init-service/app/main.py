from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from app.db import init_db
from app.config import settings
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router
from app.routes.node import router as node_router
from app.routes.project import router as project_router

app = FastAPI(
    title="init-service",
    description="Python FastAPI version of init-service for repl.io",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.client_origin],
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

@app.on_event("startup")
def startup() -> None:
    init_db()
    if settings.cas_gc_enabled:
        from app.services.cas_gc_service import cas_gc_loop
        asyncio.create_task(cas_gc_loop())

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(project_router)
app.include_router(node_router)
