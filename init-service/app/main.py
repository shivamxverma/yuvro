from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.config import settings
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

app.include_router(auth_router)
app.include_router(project_router)
app.include_router(node_router)
