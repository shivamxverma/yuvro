from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.project import router as project_router

app = FastAPI(
    title="init-service",
    description="Python FastAPI version of init-service for repl.io",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

app.include_router(project_router)
