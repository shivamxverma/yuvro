from fastapi import APIRouter, Depends

from app.routes.auth import require_current_user
from app.schemas.project import (
    ExistingWorkspaceClonePayload,
    ExistingWorkspaceTemplatePayload,
    ProjectBootstrapResponse,
    ProjectDetailResponse,
    ProjectNodesResponse,
    WorkspaceListResponse,
    WorkspaceBootstrapClonePayload,
    WorkspaceBootstrapTemplatePayload,
)
from app.services import workspace_service

router = APIRouter(tags=["projects"])


@router.get("/workspaces", response_model=WorkspaceListResponse)
def list_workspaces_route(user: dict = Depends(require_current_user)):
    return workspace_service.list_workspaces(user["id"])


@router.post("/workspaces/bootstrap/template", response_model=ProjectBootstrapResponse)
def create_template_project_route(
    payload: WorkspaceBootstrapTemplatePayload,
    user: dict = Depends(require_current_user),
):
    return workspace_service.create_template_project(
        owner_user_id=user["id"],
        workspace_name=payload.workspaceName,
        project_name=payload.projectName,
        project_type=payload.type,
    )


@router.post("/workspaces/bootstrap/clone", response_model=ProjectBootstrapResponse)
def clone_project_route(
    payload: WorkspaceBootstrapClonePayload,
    user: dict = Depends(require_current_user),
):
    return workspace_service.clone_project(
        owner_user_id=user["id"],
        workspace_name=payload.workspaceName,
        project_name=payload.projectName,
        github_url=payload.githubUrl,
    )


@router.post("/workspaces/{workspace_id}/projects/template", response_model=ProjectBootstrapResponse)
def create_project_in_workspace_route(
    workspace_id: str,
    payload: ExistingWorkspaceTemplatePayload,
    user: dict = Depends(require_current_user),
):
    return workspace_service.create_template_project_in_workspace(
        owner_user_id=user["id"],
        workspace_id=workspace_id,
        project_name=payload.projectName,
        project_type=payload.type,
    )


@router.post("/workspaces/{workspace_id}/projects/clone", response_model=ProjectBootstrapResponse)
def clone_project_in_workspace_route(
    workspace_id: str,
    payload: ExistingWorkspaceClonePayload,
    user: dict = Depends(require_current_user),
):
    return workspace_service.clone_project_in_workspace(
        owner_user_id=user["id"],
        workspace_id=workspace_id,
        project_name=payload.projectName,
        github_url=payload.githubUrl,
    )


@router.get("/projects/{project_id}", response_model=ProjectDetailResponse)
def get_project_route(project_id: str, user: dict = Depends(require_current_user)):
    return workspace_service.get_project_detail(user["id"], project_id)


@router.get("/projects/{project_id}/nodes", response_model=ProjectNodesResponse)
def get_project_nodes_route(project_id: str, user: dict = Depends(require_current_user)):
    return workspace_service.get_project_nodes(user["id"], project_id)
