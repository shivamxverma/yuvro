from datetime import datetime

from pydantic import BaseModel, Field


class WorkspaceBootstrapTemplatePayload(BaseModel):
    workspaceName: str = Field(..., min_length=1, max_length=120)
    projectName: str = Field(..., min_length=1, max_length=120)
    type: str = Field(..., min_length=1, max_length=40)


class WorkspaceBootstrapClonePayload(BaseModel):
    workspaceName: str = Field(..., min_length=1, max_length=120)
    projectName: str = Field(..., min_length=1, max_length=120)
    githubUrl: str = Field(..., min_length=1, max_length=2048)


class ExistingWorkspaceTemplatePayload(BaseModel):
    projectName: str = Field(..., min_length=1, max_length=120)
    type: str = Field(..., min_length=1, max_length=40)


class ExistingWorkspaceClonePayload(BaseModel):
    projectName: str = Field(..., min_length=1, max_length=120)
    githubUrl: str = Field(..., min_length=1, max_length=2048)


class WorkspaceSummary(BaseModel):
    id: str
    ownerUserId: str
    name: str
    slug: str
    createdAt: datetime
    updatedAt: datetime


class ProjectSummary(BaseModel):
    id: str
    workspaceId: str
    name: str
    slug: str
    type: str
    createdAt: datetime
    updatedAt: datetime


class WorkspaceWithProjectsSummary(WorkspaceSummary):
    projects: list[ProjectSummary]


class NodeSummary(BaseModel):
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


class ProjectBootstrapResponse(BaseModel):
    workspace: WorkspaceSummary
    project: ProjectSummary
    rootNode: NodeSummary


class ProjectDetailResponse(BaseModel):
    workspace: WorkspaceSummary
    project: ProjectSummary
    rootNode: NodeSummary


class ProjectNodesResponse(BaseModel):
    nodes: list[NodeSummary]


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceWithProjectsSummary]
