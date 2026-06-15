from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    root_path: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    owner: Mapped["User"] = relationship(back_populates="workspaces")
    projects: Mapped[list["Project"]] = relationship(
        back_populates="workspace",
        cascade="all, delete-orphan",
    )


class ProjectTemplate(Base):
    __tablename__ = "project_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    language: Mapped[str] = mapped_column(String(80), nullable=False)
    runtime: Mapped[str | None] = mapped_column(String(120), nullable=True)
    docker_image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bootstrap_source: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    projects: Mapped[list["Project"]] = relationship(back_populates="template")


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_project_workspace_name"),
        Index("idx_projects_workspace_id", "workspace_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    template_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("project_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    root_path: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    workspace: Mapped["Workspace"] = relationship(back_populates="projects")
    template: Mapped["ProjectTemplate | None"] = relationship(back_populates="projects")
    folders: Mapped[list["Folder"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    files: Mapped[list["File"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )


class Folder(Base):
    __tablename__ = "folders"
    __table_args__ = (
        UniqueConstraint("project_id", "path", name="uq_folder_project_path"),
        Index("idx_folders_project_parent", "project_id", "parent_folder_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_folder_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    project: Mapped["Project"] = relationship(back_populates="folders")
    parent_folder: Mapped["Folder | None"] = relationship(
        remote_side="Folder.id",
        back_populates="child_folders",
    )
    child_folders: Mapped[list["Folder"]] = relationship(
        back_populates="parent_folder",
        cascade="all, delete-orphan",
    )
    files: Mapped[list["File"]] = relationship(back_populates="folder")


class File(Base):
    __tablename__ = "files"
    __table_args__ = (
        UniqueConstraint("project_id", "path", name="uq_file_project_path"),
        Index("idx_files_project_folder", "project_id", "folder_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    folder_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("folders.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    extension: Mapped[str | None] = mapped_column(String(40), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    project: Mapped["Project"] = relationship(back_populates="files")
    folder: Mapped["Folder | None"] = relationship(back_populates="files")
