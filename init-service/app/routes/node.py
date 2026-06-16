from fastapi import APIRouter, Depends

from app.routes.auth import require_current_user
from app.schemas.node import (
    NodeChildrenResponse,
    NodeContentResponse,
    NodeContentUpdatePayload,
    NodeCreatePayload,
    NodeMovePayload,
    NodeRenamePayload,
    NodeSummaryResponse,
)
from app.services import node_service

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.get("/{node_id}/children", response_model=NodeChildrenResponse)
def get_children_route(node_id: str, user: dict = Depends(require_current_user)):
    return node_service.get_children(user["id"], node_id)


@router.get("/{node_id}/content", response_model=NodeContentResponse)
def get_content_route(node_id: str, user: dict = Depends(require_current_user)):
    return node_service.read_content(user["id"], node_id)


@router.post("", response_model=NodeSummaryResponse)
def create_node_route(payload: NodeCreatePayload, user: dict = Depends(require_current_user)):
    return node_service.create_node(user["id"], payload.parent_id, payload.name, payload.type)


@router.put("/{node_id}/content", response_model=NodeSummaryResponse)
def update_content_route(
    node_id: str,
    payload: NodeContentUpdatePayload,
    user: dict = Depends(require_current_user),
):
    return node_service.update_content(user["id"], node_id, payload.content)


@router.patch("/{node_id}", response_model=NodeSummaryResponse)
def rename_node_route(node_id: str, payload: NodeRenamePayload, user: dict = Depends(require_current_user)):
    return node_service.rename_node(user["id"], node_id, payload.name)


@router.patch("/{node_id}/move", response_model=NodeSummaryResponse)
def move_node_route(node_id: str, payload: NodeMovePayload, user: dict = Depends(require_current_user)):
    return node_service.move_node(user["id"], node_id, payload.parent_id)


@router.delete("/{node_id}", response_model=NodeSummaryResponse)
def delete_node_route(node_id: str, user: dict = Depends(require_current_user)):
    return node_service.delete_node(user["id"], node_id)
