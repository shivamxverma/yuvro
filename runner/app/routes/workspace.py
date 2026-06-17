from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.controllers import workspace_controller

router = APIRouter()

class StartPayload(BaseModel):
    projectId: str
    projectType: str


class CppRunPayload(BaseModel):
    entryPath: str

@router.post("/start")
async def start_pod_route(payload: StartPayload):
    return await workspace_controller.start_pod(payload.projectId, payload.projectType)


@router.post("/run/cpp")
async def run_cpp_route(payload: CppRunPayload):
    try:
        return await workspace_controller.run_cpp(payload.entryPath)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.get("/port/{repl_id}")
async def get_port_route(repl_id: str, container_port: int = 8000):
    return await workspace_controller.get_port(repl_id, container_port)

@router.api_route("/proxy/{repl_id}/{container_port}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_route(repl_id: str, container_port: int, path: str, request: Request):
    return await workspace_controller.proxy(repl_id, path, request, container_port)

@router.api_route("/proxy/{repl_id}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_route_legacy(repl_id: str, path: str, request: Request, container_port: int = 8000):
    return await workspace_controller.proxy(repl_id, path, request, container_port)
