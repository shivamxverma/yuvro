import os
import shutil
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select

from app.db import session_scope
from app.models.project import Node
from app.services.cas_service import hash_content, hash_file, upload_file_if_missing, upload_if_missing
from app.services.workspace_service import (
    get_node,
    project_disk_path,
    relative_path_for_node,
    serialize_node,
)

LIVE_SYNC_IGNORE_NAMES = {".git", "__pycache__", ".pytest_cache"}


def _now() -> datetime:
    return datetime.now(UTC)


def _validate_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot be empty.")
    if "/" in normalized or "\\" in normalized:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot contain path separators.")
    return normalized


def _node_abs_path(session, node: Node) -> str:
    rel_path = relative_path_for_node(session, node)
    return os.path.join(project_disk_path(node.project.workspace_id, node.project_id), rel_path) if rel_path else project_disk_path(node.project.workspace_id, node.project_id)


def _assert_folder(node: Node) -> None:
    if node.type != "FOLDER":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Target node must be a folder.")


def _assert_file(node: Node) -> None:
    if node.type != "FILE":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Target node must be a file.")


def _content_hash_for_path(abs_path: str, existing_node: Node | None = None) -> tuple[str | None, int | None]:
    try:
        size_bytes = os.path.getsize(abs_path)
    except OSError:
        return None, None

    if existing_node and existing_node.content_hash and existing_node.size_bytes == size_bytes:
        return existing_node.content_hash, existing_node.size_bytes

    try:
        content_hash, size_bytes = hash_file(abs_path)
    except OSError:
        return None, None

    upload_file_if_missing(content_hash, abs_path)
    return content_hash, size_bytes


def _sync_folder_children(session, parent: Node) -> None:
    abs_path = _node_abs_path(session, parent)
    if not os.path.isdir(abs_path):
        return

    existing_children = {
        child.name: child
        for child in session.scalars(
            select(Node).where(Node.parent_id == parent.id)
        ).all()
    }

    discovered_entries: list[os.DirEntry[str]] = []
    with os.scandir(abs_path) as entries:
        for entry in entries:
            if entry.name in LIVE_SYNC_IGNORE_NAMES:
                continue
            discovered_entries.append(entry)

    discovered_names = {entry.name for entry in discovered_entries}
    for child_name, child in existing_children.items():
        if child_name not in discovered_names:
            session.delete(child)
    session.flush()

    now = _now()
    for entry in sorted(discovered_entries, key=lambda current: (not current.is_dir(follow_symlinks=False), current.name.lower())):
        existing = existing_children.get(entry.name)

        if entry.is_dir(follow_symlinks=False):
            if existing is None:
                session.add(
                    Node(
                        id=str(uuid.uuid4()),
                        project_id=parent.project_id,
                        parent_id=parent.id,
                        name=entry.name,
                        type="FOLDER",
                        content_hash=None,
                        size_bytes=None,
                        created_at=now,
                        updated_at=now,
                    )
                )
                continue

            if existing.type != "FOLDER":
                existing.type = "FOLDER"
                existing.content_hash = None
                existing.size_bytes = None
                existing.updated_at = now
            continue

        if not entry.is_file(follow_symlinks=False):
            continue

        content_hash, size_bytes = _content_hash_for_path(entry.path, existing if existing and existing.type == "FILE" else None)
        if existing is None:
            session.add(
                Node(
                    id=str(uuid.uuid4()),
                    project_id=parent.project_id,
                    parent_id=parent.id,
                    name=entry.name,
                    type="FILE",
                    content_hash=content_hash,
                    size_bytes=size_bytes,
                    created_at=now,
                    updated_at=now,
                )
            )
            continue

        if existing.type != "FILE":
            existing.type = "FILE"
            existing.updated_at = now

        if existing.content_hash != content_hash or existing.size_bytes != size_bytes:
            existing.content_hash = content_hash
            existing.size_bytes = size_bytes
            existing.updated_at = now

    session.flush()


def get_children(owner_user_id: str, node_id: str) -> dict:
    with session_scope() as session:
        node = get_node(session, node_id, owner_user_id)
        _assert_folder(node)
        _sync_folder_children(session, node)
        children = session.scalars(
            select(Node)
            .where(Node.parent_id == node.id)
            .order_by(Node.type.desc(), Node.name)
        ).all()
        return {"nodes": [serialize_node(session, child) for child in children]}


def read_content(owner_user_id: str, node_id: str) -> dict:
    with session_scope() as session:
        node = get_node(session, node_id, owner_user_id)
        _assert_file(node)
        abs_path = _node_abs_path(session, node)
        try:
            with open(abs_path, "r", encoding="utf-8") as handle:
                content = handle.read()
        except FileNotFoundError:
            content = ""
        return {"node": serialize_node(session, node), "content": content}


def create_node(owner_user_id: str, parent_id: str, name: str, node_type: str) -> dict:
    with session_scope() as session:
        parent = get_node(session, parent_id, owner_user_id)
        _assert_folder(parent)
        node_name = _validate_name(name)
        now = _now()
        node = Node(
            id=str(uuid.uuid4()),
            project_id=parent.project_id,
            parent_id=parent.id,
            name=node_name,
            type=node_type,
            content_hash=None,
            size_bytes=None,
            created_at=now,
            updated_at=now,
        )
        session.add(node)
        session.flush()

        abs_path = _node_abs_path(session, node)
        if node_type == "FOLDER":
            os.makedirs(abs_path, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, "w", encoding="utf-8") as handle:
                handle.write("")
        session.flush()
        return serialize_node(session, node)


def update_content(owner_user_id: str, node_id: str, content: str) -> dict:
    payload = content.encode("utf-8")
    content_hash = hash_content(payload)
    upload_if_missing(content_hash, payload)

    with session_scope() as session:
        node = get_node(session, node_id, owner_user_id)
        _assert_file(node)
        abs_path = _node_abs_path(session, node)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as handle:
            handle.write(content)
        node.content_hash = content_hash
        node.size_bytes = len(payload)
        node.updated_at = _now()
        session.flush()
        return serialize_node(session, node)


def rename_node(owner_user_id: str, node_id: str, name: str) -> dict:
    with session_scope() as session:
        node = get_node(session, node_id, owner_user_id)
        if node.parent_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Project root cannot be renamed.")
        old_abs_path = _node_abs_path(session, node)
        node.name = _validate_name(name)
        node.updated_at = _now()
        session.flush()
        new_abs_path = _node_abs_path(session, node)
        os.makedirs(os.path.dirname(new_abs_path), exist_ok=True)
        if os.path.exists(old_abs_path):
            os.replace(old_abs_path, new_abs_path)
        return serialize_node(session, node)


def move_node(owner_user_id: str, node_id: str, parent_id: str) -> dict:
    with session_scope() as session:
        node = get_node(session, node_id, owner_user_id)
        if node.parent_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Project root cannot be moved.")
        target_parent = get_node(session, parent_id, owner_user_id)
        _assert_folder(target_parent)
        if target_parent.project_id != node.project_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cannot move nodes across projects.")

        current = target_parent
        while current.parent_id is not None:
            if current.id == node.id:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cannot move a folder into its own descendant.")
            current = get_node(session, current.parent_id, owner_user_id)

        old_abs_path = _node_abs_path(session, node)
        node.parent_id = target_parent.id
        node.updated_at = _now()
        session.flush()
        new_abs_path = _node_abs_path(session, node)
        os.makedirs(os.path.dirname(new_abs_path), exist_ok=True)
        if os.path.exists(old_abs_path):
            os.replace(old_abs_path, new_abs_path)
        return serialize_node(session, node)


def delete_node(owner_user_id: str, node_id: str) -> dict:
    with session_scope() as session:
        node = get_node(session, node_id, owner_user_id)
        if node.parent_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Project root cannot be deleted.")
        abs_path = _node_abs_path(session, node)
        serialized = serialize_node(session, node)
        session.delete(node)
        session.flush()
        if os.path.isdir(abs_path):
            shutil.rmtree(abs_path, ignore_errors=True)
        elif os.path.exists(abs_path):
            os.remove(abs_path)
        return serialized
