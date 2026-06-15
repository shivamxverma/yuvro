import hashlib
import os
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project import File, Folder, Project


IGNORE_NAMES = {".git", ".venv", "venv", "__pycache__", "node_modules", ".pytest_cache"}


def _now() -> datetime:
    return datetime.now(UTC)


def _rel_path(root_path: str, abs_path: str) -> str:
    rel = os.path.relpath(abs_path, root_path)
    return "" if rel == "." else rel.replace(os.sep, "/")


def _hash_file(abs_path: str) -> str | None:
    try:
        digest = hashlib.sha256()
        with open(abs_path, "rb") as handle:
            for chunk in iter(lambda: handle.read(65536), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except OSError:
        return None


def sync_project_tree(session: Session, project: Project) -> None:
    session.query(File).filter(File.project_id == project.id).delete()
    session.query(Folder).filter(Folder.project_id == project.id).delete()
    session.flush()

    folder_ids: dict[str, str] = {}
    now = _now()

    for current_root, dir_names, file_names in os.walk(project.root_path):
        dir_names[:] = [name for name in dir_names if name not in IGNORE_NAMES]

        rel_dir_path = _rel_path(project.root_path, current_root)
        parent_path = os.path.dirname(rel_dir_path).replace(os.sep, "/") if rel_dir_path else ""

        if rel_dir_path:
            folder_id = str(uuid.uuid4())
            folder_ids[rel_dir_path] = folder_id
            session.add(
                Folder(
                    id=folder_id,
                    project_id=project.id,
                    parent_folder_id=folder_ids.get(parent_path),
                    name=os.path.basename(current_root),
                    path=rel_dir_path,
                    created_at=now,
                    updated_at=now,
                )
            )

        for file_name in file_names:
            if file_name in IGNORE_NAMES:
                continue
            abs_file_path = os.path.join(current_root, file_name)
            rel_file_path = _rel_path(project.root_path, abs_file_path)
            parent_folder_path = os.path.dirname(rel_file_path).replace(os.sep, "/")
            extension = os.path.splitext(file_name)[1].lstrip(".").lower() or None
            try:
                size_bytes = os.path.getsize(abs_file_path)
            except OSError:
                size_bytes = None

            session.add(
                File(
                    id=str(uuid.uuid4()),
                    project_id=project.id,
                    folder_id=folder_ids.get(parent_folder_path) if parent_folder_path else None,
                    name=file_name,
                    path=rel_file_path,
                    extension=extension,
                    size_bytes=size_bytes,
                    content_hash=_hash_file(abs_file_path),
                    created_at=now,
                    updated_at=now,
                )
            )


DEFAULT_TEMPLATES = {
    "python": {
        "name": "Python",
        "language": "python",
        "runtime": "python3",
        "docker_image": "python:3.13-slim",
    },
    "fastapi": {
        "name": "FastAPI",
        "language": "python",
        "runtime": "uvicorn",
        "docker_image": "python:3.13-slim",
    },
    "django": {
        "name": "Django",
        "language": "python",
        "runtime": "django",
        "docker_image": "python:3.13-slim",
    },
    "flask": {
        "name": "Flask",
        "language": "python",
        "runtime": "flask",
        "docker_image": "python:3.13-slim",
    },
}


def ensure_templates(session: Session, templates_root: str) -> None:
    from app.models.project import ProjectTemplate

    now = _now()
    for slug, metadata in DEFAULT_TEMPLATES.items():
        template = session.scalar(
            select(ProjectTemplate).where(ProjectTemplate.slug == slug)
        )
        bootstrap_source = os.path.join(templates_root, slug)
        if template:
            template.name = metadata["name"]
            template.language = metadata["language"]
            template.runtime = metadata["runtime"]
            template.docker_image = metadata["docker_image"]
            template.bootstrap_source = bootstrap_source
            template.updated_at = now
            continue

        session.add(
            ProjectTemplate(
                id=str(uuid.uuid4()),
                slug=slug,
                name=metadata["name"],
                language=metadata["language"],
                runtime=metadata["runtime"],
                docker_image=metadata["docker_image"],
                bootstrap_source=bootstrap_source,
                created_at=now,
                updated_at=now,
            )
        )
