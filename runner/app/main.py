import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
import uvicorn
from app.websocket.events import init_ws
from app.routes.workspace import router as workspace_router
from app.routes.db import router as db_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(workspace_router)
app.include_router(db_router)

# Set up Socket.IO
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
init_ws(sio) 
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 3002))
    
    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=port,
        reload=True,
        reload_excludes=["workspace/*", "runner.log", "*.log"],
    )
