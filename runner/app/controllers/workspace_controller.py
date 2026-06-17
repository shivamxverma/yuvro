import os
import asyncio
import subprocess
import tempfile
import httpx
from fastapi import Request, Response
from app.core.config import BASE_DIR

PYTHON_PROJECT_TYPES = {"python", "fastapi", "flask", "django"}


def setup_virtualenv_bg(base_dir: str, project_type: str):
    """Run in background thread - create the workspace venv and install deps inside the pod."""
    if project_type not in PYTHON_PROJECT_TYPES:
        print(f"[BG] Skipping virtual environment setup for project type '{project_type}'.")
        return

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

async def start_pod(project_id: str, project_type: str):
    # Create the workspace venv only for Python-family projects.
    asyncio.get_event_loop().run_in_executor(None, setup_virtualenv_bg, BASE_DIR, project_type)
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


def _resolve_cpp_entry(entry_path: str) -> str:
    normalized = (entry_path or "").strip()
    if not normalized:
        raise ValueError("Entry file is required.")

    abs_path = os.path.realpath(os.path.join(BASE_DIR, normalized))
    base_path = os.path.realpath(BASE_DIR)
    if abs_path != base_path and not abs_path.startswith(base_path + os.sep):
        raise ValueError("Entry file must stay inside the workspace.")
    if not os.path.isfile(abs_path):
        raise ValueError("Entry file was not found.")
    if os.path.splitext(abs_path)[1].lower() not in {".cpp", ".cc", ".cxx"}:
        raise ValueError("Only C++ source files can be executed with this endpoint.")
    return abs_path


def _run_cpp_sync(entry_path: str) -> dict:
    resolved_entry = _resolve_cpp_entry(entry_path)

    with tempfile.TemporaryDirectory(prefix="yuvro_cpp_run_") as temp_dir:
        binary_path = os.path.join(temp_dir, "program")

        compile_result = subprocess.run(
            ["g++", "-std=c++17", "-O2", "-Wall", "-Wextra", resolved_entry, "-o", binary_path],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            timeout=30,
        )
        compile_output = f"{compile_result.stdout}{compile_result.stderr}"
        if compile_result.returncode != 0:
            return {
                "status": "compile_error",
                "exitCode": compile_result.returncode,
                "output": compile_output,
            }

        try:
            run_result = subprocess.run(
                [binary_path],
                cwd=BASE_DIR,
                capture_output=True,
                text=True,
                timeout=10,
            )
        except subprocess.TimeoutExpired as exc:
            timeout_output = f"{exc.stdout or ''}{exc.stderr or ''}"
            return {
                "status": "timeout",
                "exitCode": None,
                "output": f"{timeout_output}\nExecution timed out after 10 seconds.\n".lstrip(),
            }

        return {
            "status": "ok" if run_result.returncode == 0 else "runtime_error",
            "exitCode": run_result.returncode,
            "output": f"{compile_output}{run_result.stdout}{run_result.stderr}",
        }


async def run_cpp(entry_path: str) -> dict:
    return await asyncio.to_thread(_run_cpp_sync, entry_path)
