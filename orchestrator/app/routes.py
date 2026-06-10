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
        
        print(f"[Orchestrator] Starting container {container_name} mounting {host_workspace_dir}")
        env_vars = get_runner_env()
        
        try:
            docker_service.start_container(container_name, host_workspace_dir, env_vars)
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
