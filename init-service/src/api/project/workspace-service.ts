import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "../../loaders/postgres";
import { workspaces as workspacesTable, projects as projectsTable, nodes as nodesTable } from "db-schema";
import config from "../../config";
import ApiError from "../../utils/ApiError";
import { hashFile, uploadFileIfMissing } from "../../shared/cas-service";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INITIAL_INDEX_IGNORE_NAMES = new Set([".git", ".venv", "venv", "__pycache__", "node_modules", ".pytest_cache"]);
const BASE_DIR = path.resolve(__dirname, "../../../..");
export const WORKSPACES_DIR = process.env.WORKSPACES_DIR || path.join(BASE_DIR, "workspaces");
export const TEMPLATES_DIR = process.env.TEMPLATES_DIR || path.join(BASE_DIR, "runner", "templates");
export const TEMPLATE_MANIFESTS_DIR = process.env.TEMPLATE_MANIFESTS_DIR || path.join(BASE_DIR, "runner", "template_manifests");

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || crypto.randomUUID().substring(0, 8);
}

export function workspaceDiskPath(workspaceId: string): string {
  return path.join(WORKSPACES_DIR, workspaceId);
}

export function projectDiskPath(workspaceId: string, projectId: string): string {
  return path.join(workspaceDiskPath(workspaceId), projectId);
}

function serializeWorkspace(workspace: any): any {
  return {
    id: workspace.id,
    ownerUserId: workspace.ownerUserId,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

function serializeProject(project: any): any {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    slug: project.slug,
    type: project.type,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function serializeWorkspaceWithProjects(workspace: any, projects: any[]): any {
  const sortedProjects = [...projects].sort((a, b) => {
    const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  return {
    ...serializeWorkspace(workspace),
    projects: sortedProjects.map(serializeProject),
  };
}

// Calculates segment-based node path e.g. "/src/main.js"
export async function nodePath(node: any, tx: any = db): Promise<string> {
  if (!node.parentId) {
    return "/";
  }

  const segments: string[] = [];
  let current = node;

  while (current.parentId) {
    segments.push(current.name);
    const parents = await tx
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.id, current.parentId));

    const parent = parents[0];
    if (!parent) break;
    current = parent;
  }

  return "/" + segments.reverse().join("/");
}

export async function serializeNode(node: any, tx: any = db): Promise<any> {
  const pathVal = await nodePath(node, tx);
  return {
    id: node.id,
    projectId: node.projectId,
    parentId: node.parentId,
    name: node.name,
    type: node.type,
    path: pathVal,
    contentHash: node.contentHash,
    sizeBytes: node.sizeBytes,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    isRoot: !node.parentId,
  };
}

export function validateName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new ApiError("Name cannot be empty.", 422);
  }
  if (normalized.includes("/") || normalized.includes("\\")) {
    throw new ApiError("Name cannot contain path separators.", 422);
  }
  return normalized;
}

export async function getWorkspaceForOwner(ownerUserId: string, workspaceId: string, tx: any = db): Promise<any> {
  const workspaces = await tx
    .select()
    .from(workspacesTable)
    .where(
      and(
        eq(workspacesTable.id, workspaceId),
        eq(workspacesTable.ownerUserId, ownerUserId)
      )
    );

  const workspace = workspaces[0];
  if (!workspace) {
    throw new ApiError("Workspace not found.", 404);
  }
  return workspace;
}

async function contentHashForFile(absPath: string): Promise<[string | null, number | null]> {
  try {
    const [contentHash, sizeBytes] = await hashFile(absPath);
    await uploadFileIfMissing(contentHash, absPath);
    return [contentHash, sizeBytes];
  } catch {
    return [null, null];
  }
}

async function createRootNode(tx: any, project: any): Promise<any> {
  const now = new Date();
  const rootNode = {
    id: crypto.randomUUID(),
    projectId: project.id,
    parentId: null,
    name: project.slug,
    type: "FOLDER",
    contentHash: null,
    sizeBytes: null,
    createdAt: now,
    updatedAt: now,
  };

  await tx.insert(nodesTable).values(rootNode);
  return rootNode;
}

// Recursively walks through projectDir and populates the database Node representations
async function indexTree(tx: any, project: any, rootNode: any, projectDir: string): Promise<void> {
  const folderIds: Record<string, string> = { "": rootNode.id };
  const now = new Date();

  function walk(currentDir: string) {
    const list = fs.readdirSync(currentDir);
    const relDirRaw = path.relative(projectDir, currentDir);
    const relDir = relDirRaw === "" ? "" : relDirRaw.replace(/\\/g, "/");

    const dirs: string[] = [];
    const files: string[] = [];

    for (const file of list) {
      if (INITIAL_INDEX_IGNORE_NAMES.has(file)) continue;
      const fullPath = path.join(currentDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        dirs.push(file);
      } else {
        files.push(file);
      }
    }

    return { relDir, dirs, files, currentDir };
  }

  // Use a queue to implement BFS/DFS tree scan
  const queue = [projectDir];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const { relDir, dirs, files } = walk(current);

    if (relDir) {
      const parentRel = path.dirname(relDir).replace(/\\/g, "/");
      const parentRelNormalized = parentRel === "." ? "" : parentRel;

      const nodeId = crypto.randomUUID();
      const node = {
        id: nodeId,
        projectId: project.id,
        parentId: folderIds[parentRelNormalized] || rootNode.id,
        name: path.basename(current),
        type: "FOLDER",
        contentHash: null,
        sizeBytes: null,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(nodesTable).values(node);
      folderIds[relDir] = nodeId;
    }

    for (const file of files) {
      const absFile = path.join(current, file);
      const relFile = path.relative(projectDir, absFile).replace(/\\/g, "/");
      const parentRel = path.dirname(relFile).replace(/\\/g, "/");
      const parentRelNormalized = parentRel === "." ? "" : parentRel;

      const [contentHash, sizeBytes] = await contentHashForFile(absFile);
      await tx.insert(nodesTable).values({
        id: crypto.randomUUID(),
        projectId: project.id,
        parentId: folderIds[parentRelNormalized] || rootNode.id,
        name: file,
        type: "FILE",
        contentHash,
        sizeBytes,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const dir of dirs) {
      queue.push(path.join(current, dir));
    }
  }
}

function loadTemplateManifest(projectType: string): any | null {
  const manifestPath = path.join(TEMPLATE_MANIFESTS_DIR, `${projectType}.json`);
  if (!fs.existsSync(manifestPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (data.version !== 1 || data.templateType !== projectType) return null;
    if (!Array.isArray(data.directories) || !Array.isArray(data.files)) return null;
    return data;
  } catch {
    return null;
  }
}

async function indexTreeFromManifest(tx: any, project: any, rootNode: any, manifest: any): Promise<void> {
  const folderIds: Record<string, string> = { "": rootNode.id };
  const now = new Date();

  // Sort directories by path segment count to create parents before children
  const directories = (manifest.directories || [])
    .map((entry: any) => (entry.path || "").replace(/^\/|\/$/g, ""))
    .filter(Boolean)
    .sort((a: string, b: string) => {
      const aCount = (a.match(/\//g) || []).length;
      const bCount = (b.match(/\//g) || []).length;
      if (aCount !== bCount) return aCount - bCount;
      return a.localeCompare(b);
    });

  for (const relDir of directories) {
    const parentRel = path.dirname(relDir).replace(/\\/g, "/");
    const parentRelNormalized = parentRel === "." ? "" : parentRel;

    const nodeId = crypto.randomUUID();
    await tx.insert(nodesTable).values({
      id: nodeId,
      projectId: project.id,
      parentId: folderIds[parentRelNormalized] || rootNode.id,
      name: path.basename(relDir),
      type: "FOLDER",
      contentHash: null,
      sizeBytes: null,
      createdAt: now,
      updatedAt: now,
    });
    folderIds[relDir] = nodeId;
  }

  for (const entry of manifest.files || []) {
    const relFile = (entry.path || "").replace(/^\/|\/$/g, "");
    if (!relFile) continue;

    const parentRel = path.dirname(relFile).replace(/\\/g, "/");
    const parentRelNormalized = parentRel === "." ? "" : parentRel;

    await tx.insert(nodesTable).values({
      id: crypto.randomUUID(),
      projectId: project.id,
      parentId: folderIds[parentRelNormalized] || rootNode.id,
      name: path.basename(relFile),
      type: "FILE",
      contentHash: entry.contentHash || null,
      sizeBytes: typeof entry.sizeBytes === "number" ? entry.sizeBytes : null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function copyTemplate(projectType: string, targetDir: string): void {
  const templateDir = path.join(TEMPLATES_DIR, projectType);
  if (!fs.existsSync(templateDir)) {
    throw new ApiError(`Unsupported project type '${projectType}'.`, 422);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(templateDir, targetDir, {
    recursive: true,
    filter: (src) => {
      const name = path.basename(src);
      return !INITIAL_INDEX_IGNORE_NAMES.has(name);
    },
  });
}

async function cloneRepository(githubUrl: string, targetDir: string): Promise<void> {
  if (
    !githubUrl.startsWith("https://github.com/") &&
    !githubUrl.startsWith("http://github.com/") &&
    !githubUrl.startsWith("git@github.com:")
  ) {
    throw new ApiError("Only GitHub repositories are supported.", 422);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yuvro_clone_"));
  const cloneTarget = path.join(tmpDir, "repo");

  try {
    await execAsync(`git clone --depth 1 "${githubUrl}" "${cloneTarget}"`);
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy excluding .git
    fs.cpSync(cloneTarget, targetDir, {
      recursive: true,
      filter: (src) => {
        const name = path.basename(src);
        return name !== ".git";
      },
    });
  } catch (error: any) {
    throw new ApiError(error.stderr?.trim() || "git clone failed.", 400);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

async function bootstrapProject(
  workspace: any,
  projectName: string,
  projectType: string,
  bootstrapFn: (projectDir: string) => Promise<void> | void
): Promise<any> {
  const now = new Date();
  const normalizedName = validateName(projectName);
  const projectId = crypto.randomUUID();

  const project = {
    id: projectId,
    workspaceId: workspace.id,
    name: normalizedName,
    slug: slugify(normalizedName),
    type: projectType,
    createdAt: now,
    updatedAt: now,
  };

  const projectDir = projectDiskPath(workspace.id, projectId);
  fs.mkdirSync(workspaceDiskPath(workspace.id), { recursive: true });
  fs.mkdirSync(projectDir, { recursive: true });

  try {
    await bootstrapFn(projectDir);

    return await db.transaction(async (tx) => {
      // Fetch and update workspace updatedAt
      await tx
        .update(workspacesTable)
        .set({ updatedAt: now })
        .where(eq(workspacesTable.id, workspace.id));

      await tx.insert(projectsTable).values(project);

      const rootNode = await createRootNode(tx, project);
      const manifest = projectType !== "github" ? loadTemplateManifest(projectType) : null;

      if (manifest) {
        await indexTreeFromManifest(tx, project, rootNode, manifest);
      } else {
        await indexTree(tx, project, rootNode, projectDir);
      }

      const serializedNode = await serializeNode(rootNode, tx);

      return {
        workspace: serializeWorkspace(workspace),
        project: serializeProject(project),
        rootNode: serializedNode,
      };
    });
  } catch (error: any) {
    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch {}

    // Check unique constraint conflict
    if (error.code === "23505" || error.message?.includes("uq_project_workspace_name")) {
      throw new ApiError(`A project named '${project.name}' already exists in this workspace.`, 409);
    }
    throw error;
  }
}

async function bootstrapWorkspaceAndProject(
  ownerUserId: string,
  workspaceName: string,
  projectName: string,
  projectType: string,
  bootstrapFn: (projectDir: string) => Promise<void> | void
): Promise<any> {
  const now = new Date();
  const normalizedWorkspaceName = validateName(workspaceName);
  const workspaceId = crypto.randomUUID();

  const workspace = {
    id: workspaceId,
    ownerUserId,
    name: normalizedWorkspaceName,
    slug: slugify(normalizedWorkspaceName),
    createdAt: now,
    updatedAt: now,
  };

  fs.mkdirSync(workspaceDiskPath(workspaceId), { recursive: true });

  try {
    await db.insert(workspacesTable).values(workspace);
    return await bootstrapProject(workspace, projectName, projectType, bootstrapFn);
  } catch (error) {
    // Cleanup workspace
    await db.delete(workspacesTable).where(eq(workspacesTable.id, workspaceId));
    try {
      fs.rmSync(workspaceDiskPath(workspaceId), { recursive: true, force: true });
    } catch {}
    throw error;
  }
}

// ─── Exported API Functions ──────────────────────────────────────────────────

export async function createTemplateProject(
  ownerUserId: string,
  workspaceName: string,
  projectName: string,
  projectType: string
): Promise<any> {
  return bootstrapWorkspaceAndProject(
    ownerUserId,
    workspaceName,
    projectName,
    projectType,
    (projectDir) => copyTemplate(projectType, projectDir)
  );
}

export async function cloneProject(
  ownerUserId: string,
  workspaceName: string,
  projectName: string,
  githubUrl: string
): Promise<any> {
  return bootstrapWorkspaceAndProject(
    ownerUserId,
    workspaceName,
    projectName,
    "github",
    (projectDir) => cloneRepository(githubUrl, projectDir)
  );
}

export async function createTemplateProjectInWorkspace(
  ownerUserId: string,
  workspaceId: string,
  projectName: string,
  projectType: string
): Promise<any> {
  const workspace = await getWorkspaceForOwner(ownerUserId, workspaceId);
  return bootstrapProject(workspace, projectName, projectType, (projectDir) =>
    copyTemplate(projectType, projectDir)
  );
}

export async function cloneProjectInWorkspace(
  ownerUserId: string,
  workspaceId: string,
  projectName: string,
  githubUrl: string
): Promise<any> {
  const workspace = await getWorkspaceForOwner(ownerUserId, workspaceId);
  return bootstrapProject(workspace, projectName, "github", (projectDir) =>
    cloneRepository(githubUrl, projectDir)
  );
}

export async function listWorkspaces(ownerUserId: string): Promise<any> {
  const workspaces = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerUserId, ownerUserId))
    .orderBy(desc(workspacesTable.updatedAt), desc(workspacesTable.createdAt));

  const workspacesWithProjects = await Promise.all(
    workspaces.map(async (workspace) => {
      const projects = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.workspaceId, workspace.id));
      return serializeWorkspaceWithProjects(workspace, projects);
    })
  );

  return { workspaces: workspacesWithProjects };
}

export async function getProjectDetail(ownerUserId: string, projectId: string): Promise<any> {
  const projects = await db
    .select({
      id: projectsTable.id,
      workspaceId: projectsTable.workspaceId,
      name: projectsTable.name,
      slug: projectsTable.slug,
      type: projectsTable.type,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      workspace: {
        id: workspacesTable.id,
        ownerUserId: workspacesTable.ownerUserId,
        name: workspacesTable.name,
        slug: workspacesTable.slug,
        createdAt: workspacesTable.createdAt,
        updatedAt: workspacesTable.updatedAt,
      },
    })
    .from(projectsTable)
    .innerJoin(workspacesTable, eq(projectsTable.workspaceId, workspacesTable.id))
    .where(eq(projectsTable.id, projectId));

  const project = projects[0];
  if (!project || project.workspace.ownerUserId !== ownerUserId) {
    throw new ApiError("Project not found.", 404);
  }

  const rootNodes = await db
    .select()
    .from(nodesTable)
    .where(and(eq(nodesTable.projectId, projectId), isNull(nodesTable.parentId)));

  const rootNode = rootNodes[0];
  if (!rootNode) {
    throw new ApiError("Project root node is missing.", 500);
  }

  return {
    workspace: serializeWorkspace(project.workspace),
    project: serializeProject(project),
    rootNode: await serializeNode(rootNode),
  };
}

export async function getProjectNodes(ownerUserId: string, projectId: string): Promise<any> {
  const projects = await db
    .select({
      id: projectsTable.id,
      workspace: {
        ownerUserId: workspacesTable.ownerUserId,
      },
    })
    .from(projectsTable)
    .innerJoin(workspacesTable, eq(projectsTable.workspaceId, workspacesTable.id))
    .where(eq(projectsTable.id, projectId));

  const project = projects[0];
  if (!project || project.workspace.ownerUserId !== ownerUserId) {
    throw new ApiError("Project not found.", 404);
  }

  const nodes = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.projectId, projectId))
    .orderBy(desc(nodesTable.parentId), desc(nodesTable.type), nodesTable.name); // folder before files

  const serializedNodes = await Promise.all(nodes.map((n) => serializeNode(n)));
  return { nodes: serializedNodes };
}

export async function getNode(nodeId: string, ownerUserId?: string, tx: any = db): Promise<any> {
  const nodes = await tx
    .select({
      id: nodesTable.id,
      projectId: nodesTable.projectId,
      parentId: nodesTable.parentId,
      name: nodesTable.name,
      type: nodesTable.type,
      contentHash: nodesTable.contentHash,
      sizeBytes: nodesTable.sizeBytes,
      createdAt: nodesTable.createdAt,
      updatedAt: nodesTable.updatedAt,
      project: {
        id: projectsTable.id,
        workspaceId: projectsTable.workspaceId,
        workspace: {
          id: workspacesTable.id,
          ownerUserId: workspacesTable.ownerUserId,
        },
      },
    })
    .from(nodesTable)
    .innerJoin(projectsTable, eq(nodesTable.projectId, projectsTable.id))
    .innerJoin(workspacesTable, eq(projectsTable.workspaceId, workspacesTable.id))
    .where(eq(nodesTable.id, nodeId));

  const node = nodes[0];
  if (!node) {
    throw new ApiError("Node not found.", 404);
  }

  if (ownerUserId && node.project.workspace.ownerUserId !== ownerUserId) {
    throw new ApiError("Node not found.", 404);
  }

  return node;
}

export async function relativePathForNode(node: any, tx: any = db): Promise<string> {
  const pathVal = await nodePath(node, tx);
  return pathVal.replace(/^\//, "");
}
