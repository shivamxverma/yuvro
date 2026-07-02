import fs from "fs";
import path from "path";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../loaders/postgres";
import { nodes as nodesTable } from "db-schema";
import ApiError from "../../utils/ApiError";
import { hashContent, hashFile, uploadFileIfMissing, uploadIfMissing } from "../../shared/cas-service";
import {
  getNode,
  projectDiskPath,
  relativePathForNode,
  serializeNode,
  validateName,
} from "../project/workspace-service";

const LIVE_SYNC_IGNORE_NAMES = new Set([".git", ".venv", "venv", "__pycache__", ".pytest_cache", "node_modules"]);

async function nodeAbsPath(tx: any, node: any): Promise<string> {
  const relPath = await relativePathForNode(node, tx);
  const projPath = projectDiskPath(node.project.workspace.id, node.projectId);
  return relPath ? path.join(projPath, relPath) : projPath;
}

function assertFolder(node: any): void {
  if (node.type !== "FOLDER") {
    throw new ApiError("Target node must be a folder.", 422);
  }
}

function assertFile(node: any): void {
  if (node.type !== "FILE") {
    throw new ApiError("Target node must be a file.", 422);
  }
}

async function contentHashForPath(absPath: string, existingNode?: any): Promise<[string | null, number | null]> {
  try {
    const stat = fs.statSync(absPath);
    const sizeBytes = stat.size;

    if (existingNode && existingNode.contentHash && existingNode.sizeBytes === sizeBytes) {
      return [existingNode.contentHash, existingNode.sizeBytes];
    }

    const [contentHash, calculatedSize] = await hashFile(absPath);
    await uploadFileIfMissing(contentHash, absPath);
    return [contentHash, calculatedSize];
  } catch {
    return [null, null];
  }
}

async function syncFolderChildren(tx: any, parent: any): Promise<void> {
  const absPath = await nodeAbsPath(tx, parent);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    return;
  }

  // Get existing database child nodes
  const dbChildren = await tx
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.parentId, parent.id));

  const dbChildrenMap: Record<string, any> = {};
  for (const child of dbChildren) {
    dbChildrenMap[child.name] = child;
  }

  // Scan disk children
  const diskEntries = fs.readdirSync(absPath, { withFileTypes: true });
  const discoveredEntries = diskEntries.filter((entry) => !LIVE_SYNC_IGNORE_NAMES.has(entry.name));

  const discoveredNames = new Set(discoveredEntries.map((e) => e.name));

  // 1. Delete DB nodes not found on disk
  for (const childName of Object.keys(dbChildrenMap)) {
    if (!discoveredNames.has(childName)) {
      const child = dbChildrenMap[childName];
      await tx.delete(nodesTable).where(eq(nodesTable.id, child.id));
    }
  }

  const now = new Date();

  // 2. Add / update DB nodes matching disk
  // Sort folders first
  const sortedEntries = discoveredEntries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) {
      return a.isDirectory() ? -1 : 1;
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  for (const entry of sortedEntries) {
    const existing = dbChildrenMap[entry.name];
    const entryPath = path.join(absPath, entry.name);

    if (entry.isDirectory()) {
      if (!existing) {
        await tx.insert(nodesTable).values({
          id: crypto.randomUUID(),
          projectId: parent.projectId,
          parentId: parent.id,
          name: entry.name,
          type: "FOLDER",
          contentHash: null,
          sizeBytes: null,
          createdAt: now,
          updatedAt: now,
        });
      } else if (existing.type !== "FOLDER") {
        await tx
          .update(nodesTable)
          .set({ type: "FOLDER", contentHash: null, sizeBytes: null, updatedAt: now })
          .where(eq(nodesTable.id, existing.id));
      }
      continue;
    }

    if (entry.isFile()) {
      const [contentHash, sizeBytes] = await contentHashForPath(
        entryPath,
        existing && existing.type === "FILE" ? existing : undefined
      );

      if (!existing) {
        await tx.insert(nodesTable).values({
          id: crypto.randomUUID(),
          projectId: parent.projectId,
          parentId: parent.id,
          name: entry.name,
          type: "FILE",
          contentHash,
          sizeBytes,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        const needsUpdate =
          existing.type !== "FILE" ||
          existing.contentHash !== contentHash ||
          existing.sizeBytes !== sizeBytes;

        if (needsUpdate) {
          await tx
            .update(nodesTable)
            .set({ type: "FILE", contentHash, sizeBytes, updatedAt: now })
            .where(eq(nodesTable.id, existing.id));
        }
      }
    }
  }
}

// ─── Exported Services ────────────────────────────────────────────────────────

export async function getChildren(ownerUserId: string, nodeId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const node = await getNode(nodeId, ownerUserId, tx);
    assertFolder(node);
    await syncFolderChildren(tx, node);

    const children = await tx
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.parentId, node.id))
      .orderBy(desc(nodesTable.type), nodesTable.name); // folders first, then alphabetical

    const serializedChildren = await Promise.all(children.map((c) => serializeNode(c, tx)));
    return { nodes: serializedChildren };
  });
}

export async function readContent(ownerUserId: string, nodeId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const node = await getNode(nodeId, ownerUserId, tx);
    assertFile(node);

    const absPath = await nodeAbsPath(tx, node);
    let content = "";

    try {
      // Check if file is text or binary
      const buf = fs.readFileSync(absPath);
      // Basic binary file detector (has null bytes)
      const isBinary = buf.includes(0);
      if (isBinary) {
        content = "BINARY_FILE";
      } else {
        content = buf.toString("utf-8");
      }
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        throw e;
      }
      content = "";
    }

    const serializedNode = await serializeNode(node, tx);
    return { node: serializedNode, content };
  });
}

export async function createNode(ownerUserId: string, parentId: string, name: string, nodeType: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const parent = await getNode(parentId, ownerUserId, tx);
    assertFolder(parent);

    const nodeName = validateName(name);
    const now = new Date();
    const nodeId = crypto.randomUUID();

    const node = {
      id: nodeId,
      projectId: parent.projectId,
      parentId: parent.id,
      name: nodeName,
      type: nodeType,
      contentHash: null,
      sizeBytes: null,
      createdAt: now,
      updatedAt: now,
    };

    await tx.insert(nodesTable).values(node);

    const absPath = await nodeAbsPath(tx, node);
    if (nodeType === "FOLDER") {
      fs.mkdirSync(absPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, "");
    }

    return await serializeNode(node, tx);
  });
}

export async function updateContent(ownerUserId: string, nodeId: string, content: string): Promise<any> {
  const payload = Buffer.from(content, "utf-8");
  const contentHash = hashContent(payload);
  await uploadIfMissing(contentHash, payload);

  return await db.transaction(async (tx) => {
    const node = await getNode(nodeId, ownerUserId, tx);
    assertFile(node);

    const absPath = await nodeAbsPath(tx, node);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content);

    const now = new Date();
    await tx
      .update(nodesTable)
      .set({
        contentHash,
        sizeBytes: payload.length,
        updatedAt: now,
      })
      .where(eq(nodesTable.id, nodeId));

    const updatedNode = {
      ...node,
      contentHash,
      sizeBytes: payload.length,
      updatedAt: now,
    };

    return await serializeNode(updatedNode, tx);
  });
}

export async function renameNode(ownerUserId: string, nodeId: string, name: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const node = await getNode(nodeId, ownerUserId, tx);
    if (!node.parentId) {
      throw new ApiError("Project root cannot be renamed.", 422);
    }

    const oldAbsPath = await nodeAbsPath(tx, node);
    const nodeName = validateName(name);
    const now = new Date();

    await tx
      .update(nodesTable)
      .set({ name: nodeName, updatedAt: now })
      .where(eq(nodesTable.id, nodeId));

    const updatedNode = { ...node, name: nodeName, updatedAt: now };
    const newAbsPath = await nodeAbsPath(tx, updatedNode);

    fs.mkdirSync(path.dirname(newAbsPath), { recursive: true });
    if (fs.existsSync(oldAbsPath)) {
      fs.renameSync(oldAbsPath, newAbsPath);
    }

    return await serializeNode(updatedNode, tx);
  });
}

export async function moveNode(ownerUserId: string, nodeId: string, parentId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const node = await getNode(nodeId, ownerUserId, tx);
    if (!node.parentId) {
      throw new ApiError("Project root cannot be moved.", 422);
    }

    const targetParent = await getNode(parentId, ownerUserId, tx);
    assertFolder(targetParent);

    if (targetParent.projectId !== node.projectId) {
      throw new ApiError("Cannot move nodes across projects.", 422);
    }

    // Check if moving to descendant
    let current = targetParent;
    while (current.parentId) {
      if (current.id === node.id) {
        throw new ApiError("Cannot move a folder into its own descendant.", 422);
      }
      current = await getNode(current.parentId, ownerUserId, tx);
    }

    const oldAbsPath = await nodeAbsPath(tx, node);
    const now = new Date();

    await tx
      .update(nodesTable)
      .set({ parentId: targetParent.id, updatedAt: now })
      .where(eq(nodesTable.id, nodeId));

    const updatedNode = { ...node, parentId: targetParent.id, updatedAt: now };
    const newAbsPath = await nodeAbsPath(tx, updatedNode);

    fs.mkdirSync(path.dirname(newAbsPath), { recursive: true });
    if (fs.existsSync(oldAbsPath)) {
      fs.renameSync(oldAbsPath, newAbsPath);
    }

    return await serializeNode(updatedNode, tx);
  });
}

export async function deleteNode(ownerUserId: string, nodeId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const node = await getNode(nodeId, ownerUserId, tx);
    if (!node.parentId) {
      throw new ApiError("Project root cannot be deleted.", 422);
    }

    const absPath = await nodeAbsPath(tx, node);
    const serialized = await serializeNode(node, tx);

    await tx.delete(nodesTable).where(eq(nodesTable.id, nodeId));

    if (fs.existsSync(absPath)) {
      fs.rmSync(absPath, { recursive: true, force: true });
    }

    return serialized;
  });
}
