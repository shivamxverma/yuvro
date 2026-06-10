from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router

app = FastAPI(
    title="yuvro-orchestrator",
    description="Orchestrator for managing containerized project runners",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.on_event("startup")
async def startup_event():
    import asyncio
    from app.routes import db_garbage_collector_loop
    asyncio.create_task(db_garbage_collector_loop())
