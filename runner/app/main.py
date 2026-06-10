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

from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi import Request
from urllib.parse import urlparse
import re

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        referer = request.headers.get("referer")
        if referer:
            parsed_ref = urlparse(referer)
            match = re.match(r'^/proxy/([^/]+)/(\d+)/?', parsed_ref.path)
            if match:
                repl_id = match.group(1)
                container_port = int(match.group(2))
                path = request.url.path.lstrip("/")
                from app.controllers import workspace_controller
                return await workspace_controller.proxy(repl_id, path, request, container_port)
            else:
                match_legacy = re.match(r'^/proxy/([^/]+)/?', parsed_ref.path)
                if match_legacy:
                    repl_id = match_legacy.group(1)
                    container_port = 8000
                    path = request.url.path.lstrip("/")
                    from app.controllers import workspace_controller
                    return await workspace_controller.proxy(repl_id, path, request, container_port)
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

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
