import os
import asyncio
import subprocess
import sys
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import socketio
import uvicorn
import httpx
from app.ws import init_ws
from app.fs import BASE_DIR
from app.aws import download_from_s3
from app.pty import container_registry, get_container_host_port

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StartPayload(BaseModel):
    replId: str

def setup_virtualenv_bg(base_dir: str):
    """Run in background thread - creates venv and installs deps via Docker if needed."""
    venv_dir = os.path.join(base_dir, ".venv")
    requirements_file = os.path.join(base_dir, "requirements.txt")
    is_container = os.getenv("IS_CONTAINER") == "true"
    try:
        if not os.path.exists(venv_dir):
            if is_container:
                print(f"[BG] Creating virtual environment in {venv_dir} directly inside container...")
                subprocess.run([
                    "python", "-m", "venv", ".venv"
                ], cwd=base_dir, check=True, timeout=120)
            else:
                print(f"[BG] Creating virtual environment in {venv_dir} via Docker...")
                subprocess.run([
                    "docker", "run", "--rm",
                    "-v", f"{base_dir}:/workspace",
                    "-w", "/workspace",
                    "python:3.10-slim",
                    "python", "-m", "venv", ".venv"
                ], check=True, timeout=120)
            print("[BG] Virtual environment created.")

        if os.path.exists(requirements_file):
            if is_container:
                print(f"[BG] Installing dependencies from {requirements_file} directly inside container...")
                subprocess.run([
                    ".venv/bin/pip", "install", "-r", "requirements.txt", "-q"
                ], cwd=base_dir, check=True, timeout=180)
            else:
                print(f"[BG] Installing dependencies from {requirements_file} via Docker...")
                subprocess.run([
                    "docker", "run", "--rm",
                    "-v", f"{base_dir}:/workspace",
                    "-w", "/workspace",
                    "python:3.10-slim",
                    ".venv/bin/pip", "install", "-r", "requirements.txt", "-q"
                ], check=True, timeout=180)
            print("[BG] Dependencies installed.")
    except Exception as e:
        print(f"[BG setup_virtualenv Error] Failed: {e}")

@app.post("/start")
async def start_pod(payload: StartPayload):
    repl_id = payload.replId

    # S3 download — fast or fails fast
    try:
        await download_from_s3(f"yuvro/code/{repl_id}", BASE_DIR)
    except Exception as e:
        print(f"[Start] S3 download skipped: {e}")

    # Always run venv setup in background (non-blocking)
    # It will skip venv creation if it exists but always ensures deps are installed
    asyncio.get_event_loop().run_in_executor(None, setup_virtualenv_bg, BASE_DIR)

    return {"status": "started", "message": f"Workspace initializing for {repl_id}"}


@app.get("/port/{repl_id}")
async def get_port(repl_id: str, container_port: int = 8000):
    """Return the host port Docker mapped to the container's port for a given replId."""
    container_name = container_registry.get(repl_id)
    if not container_name:
        return {"error": f"No container registered for replId={repl_id}"}
    host_port = await asyncio.to_thread(get_container_host_port, container_name, container_port)
    if host_port is None:
        return {"error": f"Container {container_name} has no port {container_port} mapped yet"}
    return {"repl_id": repl_id, "container_port": container_port, "host_port": host_port}


@app.api_route("/proxy/{repl_id}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(repl_id: str, path: str, request: Request, container_port: int = 8000):
    """Reverse-proxy HTTP requests to the user's Docker container."""
    is_container = os.getenv("IS_CONTAINER") == "true"
    
    if is_container:
        target_url = f"http://localhost:{container_port}/{path}"
    else:
        container_name = container_registry.get(repl_id)
        if not container_name:
            return Response(content=f"No container for replId={repl_id}", status_code=503)

        host_port = await asyncio.to_thread(get_container_host_port, container_name, container_port)
        if host_port is None:
            return Response(
                content=f"Container {container_name} port {container_port} not mapped yet — is the server running?",
                status_code=503
            )

        target_url = f"http://localhost:{host_port}/{path}"

    query = request.url.query
    if query:
        target_url += f"?{query}"

    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)  # Let httpx set the correct Host

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )
        except httpx.ConnectError:
            port_to_log = container_port if is_container else host_port
            return Response(
                content=f"Cannot connect to container on port {port_to_log} — is the server started?",
                status_code=503,
                media_type="text/plain",
            )

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

