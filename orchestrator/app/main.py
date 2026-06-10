import os
import time
import asyncio
import subprocess
import httpx
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

# Global locks dictionary to prevent race conditions during concurrent container creation per repl_id
start_locks = {}

class StartPayload(BaseModel):
    replId: str

def get_runner_env() -> dict:
    """Read env variables from runner/.env and current environment to propagate AWS credentials."""
    env_vars = {}
    
    # Try reading runner/.env
    runner_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../runner/.env"))
    if os.path.exists(runner_env_path):
        try:
            with open(runner_env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        key, val = line.split("=", 1)
                        env_vars[key.strip()] = val.strip()
        except Exception as e:
            print(f"[Orchestrator] Warning: Failed to read runner/.env: {e}")
            
    # Propagate from current process environment (overwrites runner/.env)
    for key in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET", "AWS_REGION", "S3_ENDPOINT"]:
        val = os.getenv(key)
        if val:
            env_vars[key] = val
            
    return env_vars

def is_container_running(container_name: str) -> bool:
    """Check if the docker container is running."""
    try:
        res = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", container_name],
            capture_output=True, text=True, timeout=5
        )
        return res.stdout.strip() == "true"
    except Exception:
        return False

def get_mapped_port(container_name: str, container_port: int = 3002) -> int:
    """Get the mapped host port for container_port."""
    try:
        res = subprocess.run(
            ["docker", "inspect", "-f",
             f'{{{{(index (index .NetworkSettings.Ports "{container_port}/tcp") 0).HostPort}}}}',
             container_name],
            capture_output=True, text=True, timeout=5
        )
        port_str = res.stdout.strip()
        if port_str and port_str.isdigit():
            return int(port_str)
    except Exception as e:
        print(f"[Orchestrator] Failed to inspect port mapping: {e}")
    raise RuntimeError(f"Could not retrieve host port mapping for {container_name}")

async def wait_for_runner(port: int) -> bool:
    """Wait for the runner FastAPI server to start responding on the mapped port."""
    url = f"http://localhost:{port}/docs"
    async with httpx.AsyncClient() as client:
        for _ in range(30): # 15 seconds max wait time
            try:
                resp = await client.get(url, timeout=1.0)
                if resp.status_code == 200:
                    return True
            except httpx.RequestError:
                pass
            await asyncio.sleep(0.5)
    return False

@app.post("/start")
async def start_container(payload: StartPayload):
    repl_id = payload.replId.strip()
    if not repl_id:
        raise HTTPException(status_code=400, detail="replId cannot be empty")
        
    # Get or create lock for this repl_id
    if repl_id not in start_locks:
        start_locks[repl_id] = asyncio.Lock()
    lock = start_locks[repl_id]
    
    async with lock:
        container_name = f"yuvro-repl-{repl_id}"
        
        # 1. Check if already running
        if is_container_running(container_name):
            try:
                port = get_mapped_port(container_name, 3002)
                print(f"[Orchestrator] Container {container_name} is already running on port {port}")
                # Quick health check: ensure runner is responding
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"http://localhost:{port}/docs", timeout=2.0)
                    if resp.status_code == 200:
                        return {"status": "started", "port": port}
                    else:
                        raise RuntimeError("Runner returned unhealthy status code")
            except Exception as e:
                print(f"[Orchestrator] Existing container running but failed healthcheck/inspection: {e}. Recreating...")
                
        # 2. Stop and remove any dead or stale container
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
        
        # 3. Create host workspace directory
        host_workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), f"../../workspaces/{repl_id}"))
        os.makedirs(host_workspace_dir, exist_ok=True)
        
        # 4. Spawning the runner container
        print(f"[Orchestrator] Starting container {container_name} mounting {host_workspace_dir}")
        
        cmd = [
            "docker", "run", "-d",
            "--name", container_name,
            "-v", f"{host_workspace_dir}:/workspace",
            "-p", "0:3002", # Runner API / Socket.io
            "-p", "0:8000", # User Web app preview
        ]
        
        # Propagate AWS environment variables
        env_vars = get_runner_env()
        for key, val in env_vars.items():
            cmd.extend(["-e", f"{key}={val}"])
            
        cmd.append("yuvro-runner:latest")
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            print(f"[Orchestrator] Failed to start Docker container: {e.stderr.decode('utf-8')}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to start project container: {e.stderr.decode('utf-8')}"
            )
            
        # 5. Get dynamic mapped port
        try:
            port = get_mapped_port(container_name, 3002)
        except Exception as e:
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
            raise HTTPException(status_code=500, detail=str(e))
            
        # 6. Wait for FastAPI to start
        healthy = await wait_for_runner(port)
        if not healthy:
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
            raise HTTPException(status_code=500, detail="Timeout: Runner service inside the container did not start in time.")
            
        # 7. Tell the containerized runner to download files from S3 to /workspace
        print(f"[Orchestrator] Triggering S3 workspace download for container {container_name} on port {port}")
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(f"http://localhost:{port}/start", json={"replId": repl_id}, timeout=30.0)
                if resp.status_code != 200:
                    print(f"[Orchestrator] Warning: Runner start returned status {resp.status_code}: {resp.text}")
            except Exception as e:
                print(f"[Orchestrator] Error triggering runner start: {e}")
                
        return {"status": "started", "port": port}
