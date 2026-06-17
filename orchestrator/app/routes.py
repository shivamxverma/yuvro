import os
import asyncio
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.config import K8S_INGRESS_PORT, WORKSPACES_DIR, get_runner_env
from app.services import k8s_service, runner_service

router = APIRouter()

start_locks = {}

class StartPayload(BaseModel):
    workspaceId: str
    projectId: str

@router.post("/start")
async def start_container(payload: StartPayload):
    workspace_id = payload.workspaceId.strip()
    project_id = payload.projectId.strip()
    if not workspace_id or not project_id:
        raise HTTPException(status_code=400, detail="workspaceId and projectId are required")
        
    if project_id not in start_locks:
        start_locks[project_id] = asyncio.Lock()
    lock = start_locks[project_id]
    
    async with lock:
        host_workspace_dir = os.path.abspath(os.path.join(WORKSPACES_DIR, workspace_id, project_id))
        os.makedirs(host_workspace_dir, exist_ok=True)

        env_vars = get_runner_env()

        try:
            public_base_url = k8s_service.ensure_runner_resources(workspace_id, project_id, env_vars)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

        healthy = await runner_service.wait_for_runner(public_base_url)
        if not healthy:
            raise HTTPException(status_code=500, detail="Timeout: Runner service did not start in time.")

        await runner_service.trigger_runner_start(public_base_url, project_id)

        return {"status": "started", "port": K8S_INGRESS_PORT, "baseUrl": public_base_url}

class DbStartPayload(BaseModel):
    projectId: str
    workspaceId: str
    engine: str

@router.post("/db/start")
async def start_db_container_route(payload: DbStartPayload):
    project_id = payload.projectId.strip()
    workspace_id = payload.workspaceId.strip()
    engine = payload.engine.strip().lower()
    
    if not workspace_id or not project_id:
        raise HTTPException(status_code=400, detail="workspaceId and projectId are required")
    if engine not in ["postgres", "mysql"]:
        raise HTTPException(status_code=400, detail="engine must be 'postgres' or 'mysql'")
        
    try:
        print(f"[Orchestrator] Provisioning Kubernetes DB {engine} for projectId={project_id}...")
        connection = k8s_service.ensure_database_resources(project_id, engine)
        await asyncio.to_thread(k8s_service.wait_for_database_resources, project_id, engine)
        return connection
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def db_garbage_collector_loop():
    """Kubernetes-backed database resources are managed by the cluster."""
    while True:
        await asyncio.sleep(30)
