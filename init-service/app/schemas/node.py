from datetime import datetime

from pydantic import BaseModel, Field


class NodeCreatePayload(BaseModel):
    parent_id: str
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., pattern="^(FILE|FOLDER)$")


class NodeRenamePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class NodeMovePayload(BaseModel):
    parent_id: str


class NodeContentUpdatePayload(BaseModel):
    content: str


class NodeSummaryResponse(BaseModel):
    id: str
    projectId: str
    parentId: str | None
    name: str
    type: str
    path: str
    contentHash: str | None = None
    sizeBytes: int | None = None
    createdAt: datetime
    updatedAt: datetime
    isRoot: bool = False


class NodeChildrenResponse(BaseModel):
    nodes: list[NodeSummaryResponse]


class NodeContentResponse(BaseModel):
    node: NodeSummaryResponse
    content: str
