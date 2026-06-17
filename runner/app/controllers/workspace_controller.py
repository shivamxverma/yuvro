import os
import asyncio
import subprocess
import httpx
from fastapi import Request, Response
from app.core.config import BASE_DIR

def setup_virtualenv_bg(base_dir: str):
    """Run in background thread - create the workspace venv and install deps inside the pod."""
    venv_dir = os.path.join(base_dir, ".venv")
    requirements_file = os.path.join(base_dir, "requirements.txt")

    try:
        if not os.path.exists(venv_dir):
            print(f"[BG] Creating virtual environment in {venv_dir}...")
            subprocess.run(["python", "-m", "venv", ".venv"], cwd=base_dir, check=True, timeout=120)
            print("[BG] Virtual environment created.")

        print("[BG] Ensuring pip exists in workspace virtual environment...")
        subprocess.run(
            [".venv/bin/python", "-m", "ensurepip", "--upgrade"],
            cwd=base_dir,
            check=True,
            timeout=120,
        )

        if os.path.exists(requirements_file):
            print(f"[BG] Installing dependencies from {requirements_file}...")
            subprocess.run(
                [".venv/bin/python", "-m", "pip", "install", "-r", "requirements.txt", "-q"],
                cwd=base_dir,
                check=True,
                timeout=180,
            )
            print("[BG] Dependencies installed.")
    except Exception as e:
        print(f"[BG setup_virtualenv Error] Failed: {e}")

async def start_pod(project_id: str):
    # Always run venv setup in background (non-blocking)
    asyncio.get_event_loop().run_in_executor(None, setup_virtualenv_bg, BASE_DIR)
    return {"status": "started", "message": f"Workspace initializing for {project_id}"}

async def get_port(repl_id: str, container_port: int):
    return {"repl_id": repl_id, "container_port": container_port, "host_port": container_port}

async def proxy(repl_id: str, path: str, request: Request, container_port: int):
    target_url = f"http://127.0.0.1:{container_port}/{path}"

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
            return Response(
                content=f"Cannot connect to container on port {container_port} — is the server started?",
                status_code=503,
                media_type="text/plain",
            )
