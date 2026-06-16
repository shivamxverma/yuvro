import os
import re
import shutil
import subprocess
import tempfile
import uuid
from datetime import UTC, datetime
import json

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db import session_scope
from app.models.project import Node, Project, Workspace
from app.services.cas_service import hash_file, upload_file_if_missing


INITIAL_INDEX_IGNORE_NAMES = {".git", ".venv", "venv", "__pycache__", "node_modules", ".pytest_cache"}
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
WORKSPACES_DIR = os.path.join(BASE_DIR, "workspaces")
TEMPLATES_DIR = os.path.join(BASE_DIR, "runner", "templates")
TEMPLATE_MANIFESTS_DIR = os.path.join(BASE_DIR, "runner", "template_manifests")


def _now() -> datetime:
    return datetime.now(UTC)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or uuid.uuid4().hex[:8]


def workspace_disk_path(workspace_id: str) -> str:
    return os.path.join(WORKSPACES_DIR, workspace_id)


def project_disk_path(workspace_id: str, project_id: str) -> str:
    return os.path.join(workspace_disk_path(workspace_id), project_id)


def _serialize_workspace(workspace: Workspace) -> dict:
    return {
        "id": workspace.id,
        "ownerUserId": workspace.owner_user_id,
        "name": workspace.name,
        "slug": workspace.slug,
        "createdAt": workspace.created_at,
        "updatedAt": workspace.updated_at,
    }


def _serialize_project(project: Project) -> dict:
    return {
        "id": project.id,
        "workspaceId": project.workspace_id,
        "name": project.name,
        "slug": project.slug,
        "type": project.type,
        "createdAt": project.created_at,
        "updatedAt": project.updated_at,
    }


def _node_path(session: Session, node: Node) -> str:
    if node.parent_id is None:
        return "/"

    segments: list[str] = []
    current = node
    while current.parent_id is not None:
        segments.append(current.name)
        parent = session.get(Node, current.parent_id)
        if parent is None:
            break
        current = parent
    return "/" + "/".join(reversed(segments))


def serialize_node(session: Session, node: Node) -> dict:
    return {
        "id": node.id,
        "projectId": node.project_id,
        "parentId": node.parent_id,
        "name": node.name,
        "type": node.type,
        "path": _node_path(session, node),
        "contentHash": node.content_hash,
        "sizeBytes": node.size_bytes,
        "createdAt": node.created_at,
        "updatedAt": node.updated_at,
        "isRoot": node.parent_id is None,
    }


def _validate_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot be empty.")
    if "/" in normalized or "\\" in normalized:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot contain path separators.")
    return normalized


def _content_hash_for_file(abs_path: str) -> tuple[str | None, int | None]:
    try:
        content_hash, size_bytes = hash_file(abs_path)
    except OSError:
        return None, None
    upload_file_if_missing(content_hash, abs_path)
    return content_hash, size_bytes


def _create_root_node(session: Session, project: Project) -> Node:
    now = _now()
    root_node = Node(
        id=str(uuid.uuid4()),
        project_id=project.id,
        parent_id=None,
        name=project.slug,
        type="FOLDER",
        content_hash=None,
        size_bytes=None,
        created_at=now,
        updated_at=now,
    )
    session.add(root_node)
    session.flush()
    return root_node


def _index_tree(session: Session, project: Project, root_node: Node, project_dir: str) -> None:
    folder_ids: dict[str, str] = {"": root_node.id}
    now = _now()

    for current_root, dir_names, file_names in os.walk(project_dir):
        dir_names[:] = [name for name in dir_names if name not in INITIAL_INDEX_IGNORE_NAMES]
        rel_dir = os.path.relpath(current_root, project_dir)
        rel_dir = "" if rel_dir == "." else rel_dir.replace(os.sep, "/")

        if rel_dir:
            parent_rel = os.path.dirname(rel_dir).replace(os.sep, "/")
            node = Node(
                id=str(uuid.uuid4()),
                project_id=project.id,
                parent_id=folder_ids.get(parent_rel, root_node.id),
                name=os.path.basename(current_root),
                type="FOLDER",
                content_hash=None,
                size_bytes=None,
                created_at=now,
                updated_at=now,
            )
            session.add(node)
            session.flush()
            folder_ids[rel_dir] = node.id

        for file_name in file_names:
            if file_name in INITIAL_INDEX_IGNORE_NAMES:
                continue
            abs_file = os.path.join(current_root, file_name)
            rel_file = os.path.relpath(abs_file, project_dir).replace(os.sep, "/")
            parent_rel = os.path.dirname(rel_file).replace(os.sep, "/")
            content_hash, size_bytes = _content_hash_for_file(abs_file)
            session.add(
                Node(
                    id=str(uuid.uuid4()),
                    project_id=project.id,
                    parent_id=folder_ids.get(parent_rel, root_node.id) if parent_rel else root_node.id,
                    name=file_name,
                    type="FILE",
                    content_hash=content_hash,
                    size_bytes=size_bytes,
                    created_at=now,
                    updated_at=now,
                )
            )


def _manifest_path(project_type: str) -> str:
    return os.path.join(TEMPLATE_MANIFESTS_DIR, f"{project_type}.json")


def _load_template_manifest(project_type: str) -> dict | None:
    manifest_path = _manifest_path(project_type)
    if not os.path.exists(manifest_path):
        return None
    try:
        with open(manifest_path, "r", encoding="utf-8") as handle:
            manifest = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    if manifest.get("version") != 1 or manifest.get("templateType") != project_type:
        return None
    if not isinstance(manifest.get("directories"), list) or not isinstance(manifest.get("files"), list):
        return None
    return manifest


def _index_tree_from_manifest(session: Session, project: Project, root_node: Node, manifest: dict) -> None:
    folder_ids: dict[str, str] = {"": root_node.id}
    now = _now()

    directories = sorted(
        (
            entry.get("path", "").strip("/")
            for entry in manifest.get("directories", [])
            if isinstance(entry, dict)
        ),
        key=lambda path: (path.count("/"), path),
    )
    for rel_dir in directories:
        if not rel_dir:
            continue
        parent_rel = os.path.dirname(rel_dir).replace(os.sep, "/")
        node = Node(
            id=str(uuid.uuid4()),
            project_id=project.id,
            parent_id=folder_ids.get(parent_rel, root_node.id),
            name=os.path.basename(rel_dir),
            type="FOLDER",
            content_hash=None,
            size_bytes=None,
            created_at=now,
            updated_at=now,
        )
        session.add(node)
        session.flush()
        folder_ids[rel_dir] = node.id

    for entry in manifest.get("files", []):
        if not isinstance(entry, dict):
            continue
        rel_file = str(entry.get("path", "")).strip("/")
        if not rel_file:
            continue
        parent_rel = os.path.dirname(rel_file).replace(os.sep, "/")
        session.add(
            Node(
                id=str(uuid.uuid4()),
                project_id=project.id,
                parent_id=folder_ids.get(parent_rel, root_node.id) if parent_rel else root_node.id,
                name=os.path.basename(rel_file),
                type="FILE",
                content_hash=str(entry.get("contentHash") or "") or None,
                size_bytes=entry.get("sizeBytes") if isinstance(entry.get("sizeBytes"), int) else None,
                created_at=now,
                updated_at=now,
            )
        )


def _copy_template(project_type: str, target_dir: str) -> None:
    template_dir = os.path.join(TEMPLATES_DIR, project_type)
    if not os.path.exists(template_dir):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported project type '{project_type}'.",
        )
    shutil.copytree(
        template_dir,
        target_dir,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(*INITIAL_INDEX_IGNORE_NAMES),
    )


def _clone_repository(github_url: str, target_dir: str) -> None:
    if not (
        github_url.startswith("https://github.com/")
        or github_url.startswith("http://github.com/")
        or github_url.startswith("git@github.com:")
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only GitHub repositories are supported.",
        )

    tmp_dir = tempfile.mkdtemp(prefix="yuvro_clone_")
    clone_target = os.path.join(tmp_dir, "repo")
    try:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", github_url, clone_target],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.stderr.strip() or result.stdout.strip() or "git clone failed.",
            )
        shutil.copytree(clone_target, target_dir, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git"))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _bootstrap_workspace_and_project(
    *,
    owner_user_id: str,
    workspace_name: str,
    project_name: str,
    project_type: str,
    bootstrap_fn,
) -> dict:
    workspace_id = str(uuid.uuid4())
    project_id = str(uuid.uuid4())
    now = _now()

    workspace = Workspace(
        id=workspace_id,
        owner_user_id=owner_user_id,
        name=workspace_name.strip(),
        slug=slugify(workspace_name),
        created_at=now,
        updated_at=now,
    )
    project = Project(
        id=project_id,
        workspace_id=workspace_id,
        name=project_name.strip(),
        slug=slugify(project_name),
        type=project_type,
        created_at=now,
        updated_at=now,
    )

    project_dir = project_disk_path(workspace_id, project_id)
    os.makedirs(project_dir, exist_ok=True)
    bootstrap_fn(project_dir)

    with session_scope() as session:
        session.add(workspace)
        session.add(project)
        session.flush()
        root_node = _create_root_node(session, project)
        manifest = _load_template_manifest(project_type) if project_type != "github" else None
        if manifest:
            _index_tree_from_manifest(session, project, root_node, manifest)
        else:
            _index_tree(session, project, root_node, project_dir)
        session.flush()
        return {
            "workspace": _serialize_workspace(workspace),
            "project": _serialize_project(project),
            "rootNode": serialize_node(session, root_node),
        }


def create_template_project(owner_user_id: str, workspace_name: str, project_name: str, project_type: str) -> dict:
    return _bootstrap_workspace_and_project(
        owner_user_id=owner_user_id,
        workspace_name=workspace_name,
        project_name=project_name,
        project_type=project_type,
        bootstrap_fn=lambda project_dir: _copy_template(project_type, project_dir),
    )


def clone_project(owner_user_id: str, workspace_name: str, project_name: str, github_url: str) -> dict:
    return _bootstrap_workspace_and_project(
        owner_user_id=owner_user_id,
        workspace_name=workspace_name,
        project_name=project_name,
        project_type="github",
        bootstrap_fn=lambda project_dir: _clone_repository(github_url, project_dir),
    )


def get_project_detail(owner_user_id: str, project_id: str) -> dict:
    with session_scope() as session:
        project = session.scalar(
            select(Project)
            .options(joinedload(Project.workspace))
            .where(Project.id == project_id)
        )
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        if project.workspace.owner_user_id != owner_user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        root_node = session.scalar(
            select(Node).where(Node.project_id == project.id, Node.parent_id.is_(None))
        )
        if root_node is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Project root node is missing.")
        return {
            "workspace": _serialize_workspace(project.workspace),
            "project": _serialize_project(project),
            "rootNode": serialize_node(session, root_node),
        }


def get_project_nodes(owner_user_id: str, project_id: str) -> dict:
    with session_scope() as session:
        project = session.scalar(
            select(Project)
            .options(joinedload(Project.workspace))
            .where(Project.id == project_id)
        )
        if project is None or project.workspace.owner_user_id != owner_user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        nodes = session.scalars(
            select(Node).where(Node.project_id == project_id).order_by(Node.parent_id.is_not(None), Node.type.desc(), Node.name)
        ).all()
        return {"nodes": [serialize_node(session, node) for node in nodes]}


def get_node(session: Session, node_id: str, owner_user_id: str | None = None) -> Node:
    node = session.scalar(
        select(Node)
        .options(joinedload(Node.project).joinedload(Project.workspace))
        .where(Node.id == node_id)
    )
    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found.")
    if owner_user_id and node.project.workspace.owner_user_id != owner_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found.")
    return node


def relative_path_for_node(session: Session, node: Node) -> str:
    return _node_path(session, node).lstrip("/")
