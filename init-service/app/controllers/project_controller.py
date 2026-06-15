import os
import shutil
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.db import session_scope
from app.models.project import Project, ProjectTemplate, Workspace
from app.services.project_index_service import ensure_templates, sync_project_tree
from app.services.s3_service import copy_s3_folder
from app.services.github_service import clone_github_and_upload

TEMPLATES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../runner/templates")
)
WORKSPACES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../workspaces")
)


def _now() -> datetime:
    return datetime.now(UTC)


def _upsert_workspace_with_project(
    *,
    owner_user_id: str,
    repl_id: str,
    project_name: str,
    project_slug: str,
    root_path: str,
    source_type: str,
    template_slug: str | None,
):
    with session_scope() as session:
        ensure_templates(session, TEMPLATES_DIR)
        now = _now()

        workspace = session.scalar(
            select(Workspace).where(Workspace.slug == repl_id)
        )
        if workspace is None:
            workspace = Workspace(
                id=str(uuid.uuid4()),
                owner_user_id=owner_user_id,
                slug=repl_id,
                name=repl_id,
                root_path=root_path,
                created_at=now,
                updated_at=now,
            )
            session.add(workspace)
        else:
            workspace.owner_user_id = owner_user_id
            workspace.root_path = root_path
            workspace.updated_at = now

        template = None
        if template_slug:
            template = session.scalar(
                select(ProjectTemplate).where(ProjectTemplate.slug == template_slug)
            )

        project = session.scalar(
            select(Project).where(
                Project.workspace_id == workspace.id,
                Project.slug == project_slug,
            )
        )
        if project is None:
            project = Project(
                id=str(uuid.uuid4()),
                workspace_id=workspace.id,
                template_id=template.id if template else None,
                name=project_name,
                slug=project_slug,
                root_path=root_path,
                source_type=source_type,
                created_at=now,
                updated_at=now,
            )
            session.add(project)
        else:
            project.template_id = template.id if template else None
            project.root_path = root_path
            project.source_type = source_type
            project.updated_at = now

        session.flush()
        sync_project_tree(session, project)
        session.flush()

        return {
            "workspaceId": workspace.id,
            "projectId": project.id,
        }


def create_project(owner_user_id: str, repl_id: str, language: str):
    # Try S3 copy first
    try:
        copy_s3_folder(f"yuvro/base/{language}", f"yuvro/code/{repl_id}")
    except Exception as e:
        print(f"[create_project] S3 copy failed/skipped: {e}")

    # Local sync / fallback: Copy templates directly from local runner/templates directory
    # relative to init-service folder
    local_workspace_dir = os.path.abspath(os.path.join(WORKSPACES_DIR, repl_id))
    local_template_dir = os.path.abspath(os.path.join(TEMPLATES_DIR, language))
    
    if os.path.exists(local_template_dir):
        os.makedirs(local_workspace_dir, exist_ok=True)
        shutil.copytree(local_template_dir, local_workspace_dir, dirs_exist_ok=True)
        print(f"[create_project] Copied local template from {local_template_dir} to {local_workspace_dir}")
    else:
        print(f"[create_project] Warning: Local template folder {local_template_dir} does not exist.")

    db_result = _upsert_workspace_with_project(
        owner_user_id=owner_user_id,
        repl_id=repl_id,
        project_name=repl_id,
        project_slug=repl_id,
        root_path=local_workspace_dir,
        source_type="template",
        template_slug=language,
    )
    return {
        "message": "Project created",
        **db_result,
    }

def clone_project(owner_user_id: str, repl_id: str, github_url: str):
    result = clone_github_and_upload(github_url, repl_id)
    local_workspace_dir = os.path.abspath(os.path.join(WORKSPACES_DIR, repl_id))
    db_result = _upsert_workspace_with_project(
        owner_user_id=owner_user_id,
        repl_id=repl_id,
        project_name=repl_id,
        project_slug=repl_id,
        root_path=local_workspace_dir,
        source_type="github",
        template_slug=None,
    )
    return {"message": "Project cloned successfully", **result, **db_result}
