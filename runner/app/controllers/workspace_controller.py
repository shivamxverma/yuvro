import os
import asyncio
import subprocess
import httpx
from fastapi import Request, Response
from app.core.config import BASE_DIR
from app.services.terminal import container_registry, get_container_host_port

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

async def start_pod(project_id: str):
    # Always run venv setup in background (non-blocking)
    asyncio.get_event_loop().run_in_executor(None, setup_virtualenv_bg, BASE_DIR)
    return {"status": "started", "message": f"Workspace initializing for {project_id}"}

async def get_port(repl_id: str, container_port: int):
    container_name = container_registry.get(repl_id)
    if not container_name:
        return {"error": f"No container registered for replId={repl_id}"}
    host_port = await asyncio.to_thread(get_container_host_port, container_name, container_port)
    if host_port is None:
        return {"error": f"Container {container_name} has no port {container_port} mapped yet"}
    return {"repl_id": repl_id, "container_port": container_port, "host_port": host_port}

async def proxy(repl_id: str, path: str, request: Request, container_port: int):
    is_container = os.getenv("IS_CONTAINER") == "true"
    
    if is_container:
        target_url = f"http://127.0.0.1:{container_port}/{path}"
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

        target_url = f"http://127.0.0.1:{host_port}/{path}"

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
