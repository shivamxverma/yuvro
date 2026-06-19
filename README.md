# Yuvro Online IDE

Yuvro is a browser-based coding workspace. A user signs in, creates a workspace, adds one or more projects, opens the code in the web IDE, and runs that project inside an isolated containerized environment.

This README explains the architecture in plain English and matches the current code in this repository.

![Yuvro IDE Architecture Diagram](./architecture.png)

## Architecture In Plain English

Think of Yuvro as five cooperating parts:

1. `client/`
   The React frontend. It shows the IDE UI, file tree, editor, terminal, preview panel, and database viewer.
2. `init-service/`
   The control-plane API for users, auth, workspace/project creation, file metadata, and content indexing.
3. `orchestrator/`
   The runtime manager. When a user opens a project, this service creates the Kubernetes resources needed to run it.
4. `runner/`
   The per-project workspace agent. It runs inside the project container and exposes terminal, filesystem, preview proxying, and DB browsing APIs.
5. Supporting storage
   PostgreSQL stores metadata, the filesystem stores live project files, and optional S3-backed content-addressed storage stores file blobs efficiently.

## End-To-End Flow

Here is the typical flow for one user:

1. The user signs in through `init-service`.
2. The user creates a workspace and project from a template or a GitHub repo.
3. `init-service` writes project metadata into PostgreSQL and creates an indexed file tree.
4. When the user opens the project, the frontend asks `orchestrator` to start it.
5. `orchestrator` creates a runner Deployment, Service, and Ingress in Kubernetes.
6. The runner pod mounts the project folder, starts the runtime agent, and prepares the project environment.
7. The frontend connects to the runner for terminal access, file operations, app preview, and database inspection.

## Main Components

### Frontend: `client/`

The frontend is a React + TypeScript app built with Vite. It handles:

- Authentication screens
- Workspace and project selection
- File explorer and editor UI
- Terminal session UI
- App preview through runner proxy routes
- Database viewer for SQLite, PostgreSQL, and MySQL connections

The frontend is mostly a thin UI layer. The important state and lifecycle decisions live in the backend services.

### Init Service: `init-service/`

This service is the system of record for metadata.

It handles:

- User signup, signin, logout, refresh, and OAuth
- Workspace and project creation
- Cloning GitHub repositories
- Building and reading the indexed project tree
- File and folder metadata updates
- Optional content-addressed storage uploads to S3

This is where the platform keeps track of who owns what, which project belongs to which workspace, and what files exist in each project.

### Orchestrator: `orchestrator/`

This service does not run user code itself. Its job is to ask Kubernetes to run user code safely and predictably.

When `/start` is called, it creates or updates:

- A runner `Deployment`
- A runner `Service`
- A runner `Ingress`

When a project database is requested, it creates or updates:

- A database `Deployment`
- A database `Service`
- A database `Secret`
- A database `PersistentVolumeClaim`

This separation is important:

- `init-service` manages metadata and project definition.
- `orchestrator` manages runtime infrastructure.

### Runner: `runner/`

The runner is the process inside each project container.

It provides:

- A terminal backed by a PTY
- File read/write operations
- Project startup hooks
- App preview proxying
- SQLite discovery inside the workspace
- Read-only database browsing for SQLite, PostgreSQL, and MySQL

For Python-family projects, it also creates a local virtual environment and installs dependencies in the background.

## Schema Design

The metadata schema is intentionally simple. Instead of storing all file contents in PostgreSQL, the database stores the structure of the workspace and enough metadata to find and verify files.

### Core Tables

#### `users`

Stores the account record.

- `id`
- `email`
- `name`
- timestamps

#### `auth_methods`

Stores how a user signs in.

- Local password auth
- Google OAuth
- GitHub OAuth

This lets one user have multiple signin methods without duplicating the user record.

#### `sessions`

Stores refresh-token based login sessions.

This supports:

- Session listing
- Logout from one device
- Logout from all devices
- Expiration tracking

#### `workspaces`

A workspace is the top-level container owned by a user.

One user can have many workspaces.

#### `projects`

A workspace contains one or more projects.

This is a good design choice because a workspace can group related apps, experiments, or services without creating a completely separate top-level container for each one.

#### `nodes`

This is the file tree table. It stores both folders and files in one self-referential structure.

Important fields:

- `project_id`
- `parent_id`
- `name`
- `type` (`FILE` or `FOLDER`)
- `content_hash`
- `size_bytes`

This design is effective because:

- It models the whole tree with one table.
- It supports recursive folder structures naturally.
- It avoids a separate schema for folders and files.
- It keeps database rows small because file bytes are not stored in Postgres.

## Indexing And Why It Matters

The indexing strategy is practical and tied to common queries.

### Authentication indexes

- `users.email` is unique and indexed.
  Why: signin must find a user by email quickly and reject duplicates.
- `auth_methods(provider, provider_user_id)` is unique.
  Why: one Google or GitHub identity must map to exactly one auth record.
- `auth_methods(user_id, provider)` is indexed.
  Why: loading a user's available signin methods should be fast.
- `sessions(user_id, status)` is indexed.
  Why: fetching active sessions for "manage devices" is a common path.
- `sessions(expires_at)` is indexed.
  Why: expired session cleanup and time-based lookups are cheaper.

### Workspace and project indexes

- `workspaces.owner_user_id` is indexed.
  Why: the product often asks "show me this user's workspaces".
- `projects(workspace_id, name)` is unique.
  Why: two projects in the same workspace should not have the same name.
- `projects.workspace_id` is indexed.
  Why: listing projects inside one workspace is a primary query.

### File tree indexes

- `nodes(project_id, parent_id, name)` is unique.
  Why: one folder cannot contain duplicate child names.
- `nodes(project_id, parent_id)` is indexed.
  Why: expanding a folder is one of the hottest file tree operations.
- `nodes(project_id, type)` is indexed.
  Why: quickly filtering files vs folders inside a project is useful for scans and maintenance.

In simple terms: the indexes are placed where users click most often. Sign in, load my workspaces, open this project, expand this folder.

## Storage Design And Optimization

Yuvro splits storage by responsibility.

### 1. PostgreSQL stores metadata

PostgreSQL stores small, structured, highly relational data:

- users
- sessions
- workspaces
- projects
- file tree nodes

This is the right place for ownership, relationships, uniqueness rules, and indexed lookups.

### 2. The filesystem stores the live working copy

Each project gets a directory under the workspace root. The runner works directly on these files because:

- editors need normal file reads and writes
- terminals expect a real filesystem
- frameworks and package managers expect local files

### 3. S3-backed CAS stores file blobs efficiently

The repository uses content-addressed storage through `content_hash`.

That means a file is identified by its SHA-256 hash, not by its original path.

Why this helps:

- identical files can be reused instead of stored many times
- the database only needs to store a hash and size, not full file contents
- templates can be indexed quickly using prebuilt manifests
- storage cleanup becomes easier because unreferenced hashes can be garbage collected

### 4. Template manifests reduce repeated work

The template manifest files in `runner/template_manifests/` precompute:

- directory paths
- file paths
- file content hashes
- file sizes

This avoids re-hashing every template file every time a new project is created from a known template.

### 5. CAS garbage collection keeps object storage clean

The repo includes:

- `init-service/app/services/cas_gc_service.py`
- `k8s/init-service-cas-gc-cronjob.yaml`

The cleanup job scans live `nodes.content_hash` values and removes orphaned CAS objects after a grace period.

That is a strong optimization because deduplicated object stores can grow quietly if they are never cleaned.

### 6. Unnecessary files are intentionally ignored

Both indexing and discovery skip heavy or noisy directories such as:

- `.git`
- `.venv`
- `node_modules`
- `__pycache__`
- `.pytest_cache`

Why: these folders are large, frequently regenerated, and usually not useful to show as core project metadata.

## Kubernetes Usage: Container Orchestration

This repo uses Kubernetes as the runtime control plane.

### What Kubernetes is doing here

For each active project, Kubernetes provides:

- A runner pod that hosts the project agent
- A stable Service name for internal traffic
- An Ingress route for browser access
- Optional per-project database pods
- Persistent volumes for database storage
- Secrets for database passwords

### Why Kubernetes is a good fit

#### 1. Isolation

Each project runs in its own runtime unit instead of sharing one long-lived app process. That lowers the blast radius of crashes and dependency conflicts.

#### 2. Consistent lifecycle management

The orchestrator can declare the desired state and let Kubernetes create or update the resources.

#### 3. Service discovery

The database and runner services get predictable DNS names inside the cluster.

#### 4. Persistent storage for databases

Postgres/MySQL project databases use PVCs, so data can survive container restarts.

#### 5. Health-aware startup

The database Deployments include readiness probes, which means the platform waits for the database to be usable instead of assuming it is ready immediately.

### How the runner is exposed

The orchestrator creates an Ingress per project using a host name derived from the project ID. That gives each running project its own URL path into the cluster-managed runner service.

### Important current tradeoff

The runner workspace is mounted using `hostPath`. That is practical for local development and single-node setups such as `kind`, but it is not the ideal final storage design for a multi-node production cluster. A shared network volume or object-backed workspace sync layer would be safer at larger scale.

## Why This Architecture Makes Sense

In plain terms, the design separates concerns well:

- `client` handles user interaction
- `init-service` owns metadata and project definition
- `orchestrator` owns infrastructure creation
- `runner` owns per-project execution
- PostgreSQL owns relationships and indexing
- filesystem and S3 own bulk file storage
- Kubernetes owns container orchestration

That split keeps the system easier to reason about than putting auth, metadata, filesystem logic, and container runtime logic into one service.

## Repository Map

- [client](/Users/shivamverma/Desktop/yuvro-assignment/client)
- [init-service](/Users/shivamverma/Desktop/yuvro-assignment/init-service)
- [orchestrator](/Users/shivamverma/Desktop/yuvro-assignment/orchestrator)
- [runner](/Users/shivamverma/Desktop/yuvro-assignment/runner)
- [k8s](/Users/shivamverma/Desktop/yuvro-assignment/k8s)
- [docs/schema.md](/Users/shivamverma/Desktop/yuvro-assignment/docs/schema.md)

## Local Development Notes

### Core ports

- Frontend: `5173`
- Init service: `3001`
- Orchestrator: `3002`
- Kubernetes ingress default in manifests: `8080`

### Start the main local services

```bash
make dev
```

### Build the runner image

```bash
make build-runner-image
```

## Short Summary

Yuvro is a web IDE built around a clean split:

- PostgreSQL tracks metadata and relationships.
- The filesystem holds the live project copy.
- S3 CAS improves storage efficiency.
- The runner executes project-level actions.
- Kubernetes starts and exposes isolated project environments.

If you want to understand the system quickly, start with `init-service` for metadata, `orchestrator` for runtime creation, and `runner` for the actual workspace behavior.
