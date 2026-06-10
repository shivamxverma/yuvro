import os
import asyncio
import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.config import WORKSPACES_DIR, get_runner_env, RUNNER_INTERNAL_PORT
from app.services import docker_service, runner_service

router = APIRouter()

start_locks = {}

class StartPayload(BaseModel):
    replId: str

@router.post("/start")
async def start_container(payload: StartPayload):
    repl_id = payload.replId.strip()
    if not repl_id:
        raise HTTPException(status_code=400, detail="replId cannot be empty")
        
    if repl_id not in start_locks:
        start_locks[repl_id] = asyncio.Lock()
    lock = start_locks[repl_id]
    
    async with lock:
        container_name = f"yuvro-repl-{repl_id}"
        
        if docker_service.is_container_running(container_name):
            try:
                port = docker_service.get_mapped_port(container_name, RUNNER_INTERNAL_PORT)
                print(f"[Orchestrator] Container {container_name} is already running on port {port}")
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"http://localhost:{port}/docs", timeout=2.0)
                    if resp.status_code == 200:
                        return {"status": "started", "port": port}
                    else:
                        raise RuntimeError("Runner returned unhealthy status code")
            except Exception as e:
                print(f"[Orchestrator] Existing container running but failed healthcheck/inspection: {e}. Recreating...")
                
        docker_service.remove_container(container_name)
        
        host_workspace_dir = os.path.abspath(os.path.join(WORKSPACES_DIR, repl_id))
        os.makedirs(host_workspace_dir, exist_ok=True)
        
        network_name = f"yuvro-net-{repl_id}"
        print(f"[Orchestrator] Creating bridge network {network_name}...")
        try:
            docker_service.create_network(network_name)
        except Exception as e:
            print(f"[Orchestrator] Network creation warning: {e}")
            
        print(f"[Orchestrator] Starting container {container_name} mounting {host_workspace_dir} on network {network_name}")
        env_vars = get_runner_env()
        
        try:
            docker_service.start_container(container_name, host_workspace_dir, env_vars, network=network_name)
        except RuntimeError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e)
            )
            
        try:
            port = docker_service.get_mapped_port(container_name, RUNNER_INTERNAL_PORT)
        except Exception as e:
            docker_service.remove_container(container_name)
            raise HTTPException(status_code=500, detail=str(e))
            
        healthy = await runner_service.wait_for_runner(port)
        if not healthy:
            docker_service.remove_container(container_name)
            raise HTTPException(status_code=500, detail="Timeout: Runner service inside the container did not start in time.")
            
        await runner_service.trigger_runner_start(port, repl_id)
                
        return {"status": "started", "port": port}

class DbStartPayload(BaseModel):
    replId: str
    engine: str

@router.post("/db/start")
async def start_db_container_route(payload: DbStartPayload):
    repl_id = payload.replId.strip()
    engine = payload.engine.strip().lower()
    
    if not repl_id:
        raise HTTPException(status_code=400, detail="replId cannot be empty")
    if engine not in ["postgres", "mysql"]:
        raise HTTPException(status_code=400, detail="engine must be 'postgres' or 'mysql'")
        
    container_name = f"yuvro-repl-{repl_id}"
    if not docker_service.is_container_running(container_name):
        raise HTTPException(status_code=400, detail="Workspace container is not running")

    db_container_name = f"yuvro-db-{repl_id}"
    network_name = f"yuvro-net-{repl_id}"
    host_workspace_dir = os.path.abspath(os.path.join(WORKSPACES_DIR, repl_id))

    try:
        print(f"[Orchestrator] Provisioning containerized DB {db_container_name} ({engine})...")
        docker_service.start_db_container(db_container_name, network_name, engine, host_workspace_dir)
        
        # Wait a small moment for initial connection readiness
        await asyncio.sleep(2.5)

        # Return connection credentials inside the shared network
        return {
            "status": "started",
            "engine": engine,
            "host": db_container_name,
            "port": 5432 if engine == "postgres" else 3306,
            "user": "postgres" if engine == "postgres" else "root",
            "password": "secret",
            "database": "yuvro_db"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def db_garbage_collector_loop():
    """Background task to detect and clean up orphaned database containers."""
    while True:
        try:
            import subprocess
            result = subprocess.run(
                ["docker", "ps", "--format", "{{.Names}}"],
                capture_output=True, text=True
            )
            running = set(line.strip() for line in result.stdout.split("\n") if line.strip())
            
            for name in list(running):
                if name.startswith("yuvro-db-"):
                    repl_id = name.replace("yuvro-db-", "")
                    workspace_container = f"yuvro-repl-{repl_id}"
                    
                    if workspace_container not in running:
                        print(f"[GC] Orphan database container found for replId={repl_id}. Pruning...")
                        subprocess.run(["docker", "rm", "-f", name], capture_output=True)
                        subprocess.run(["docker", "network", "rm", f"yuvro-net-{repl_id}"], capture_output=True)
        except Exception as e:
            print(f"[GC Error] {e}")
        await asyncio.sleep(30)
