import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3_service";
import config from "../config";
import logger from "../loaders/logger";
import { db } from "../loaders/postgres";
import { nodes as nodesTable } from "db-schema";
import { isNotNull } from "drizzle-orm";

const CAS_PREFIX = "yuvro/CAS";
const DELETE_BATCH_LIMIT = 1000;

function normalizeKeyPrefix(prefix: string): string {
  return prefix.endsWith("/") ? prefix : prefix + "/";
}

function extractHashFromKey(key: string): string | null {
  const prefix = normalizeKeyPrefix(CAS_PREFIX);
  if (!key.startsWith(prefix)) return null;

  const rest = key.substring(prefix.length);
  const parts = rest.split("/");
  if (parts.length !== 2) return null;

  const [shard, contentHash] = parts;
  if (shard.length !== 2 || contentHash.length !== 64) return null;
  if (contentHash.substring(0, 2) !== shard) return null;

  return contentHash;
}

export async function getLiveContentHashes(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ contentHash: nodesTable.contentHash })
    .from(nodesTable)
    .where(isNotNull(nodesTable.contentHash));

  const set = new Set<string>();
  for (const row of rows) {
    if (row.contentHash) {
      set.add(row.contentHash);
    }
  }
  return set;
}

export async function collectOrphanedObjects(graceHours: number): Promise<{
  candidates: Array<{ Key: string; hash: string; last_modified?: Date; size: number }>;
  scanned: number;
}> {
  const bucket = config.S3_BUCKET;
  if (!bucket) return { candidates: [], scanned: 0 };

  const liveHashes = await getLiveContentHashes();
  const prefix = normalizeKeyPrefix(CAS_PREFIX);
  const graceCutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000);

  const candidates: Array<{ Key: string; hash: string; last_modified?: Date; size: number }> = [];
  let scanned = 0;
  let continuationToken: string | undefined;

  do {
    const listCommand: any = {
      Bucket: bucket,
      Prefix: prefix,
    };
    if (continuationToken) {
      listCommand.ContinuationToken = continuationToken;
    }

    const response = await s3Client.send(new ListObjectsV2Command(listCommand));
    const contents = response.Contents || [];

    for (const obj of contents) {
      const key = obj.Key;
      if (!key) continue;
      scanned++;

      const contentHash = extractHashFromKey(key);
      if (!contentHash || liveHashes.has(contentHash)) continue;

      const lastModified = obj.LastModified;
      if (!lastModified || lastModified > graceCutoff) continue;

      candidates.push({
        Key: key,
        hash: contentHash,
        last_modified: lastModified,
        size: obj.Size || 0,
      });
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return { candidates, scanned };
}

export async function deleteOrphanedObjects(
  orphanedObjects: Array<{ Key: string }>,
  batchSize: number
): Promise<number> {
  const bucket = config.S3_BUCKET;
  if (!bucket || orphanedObjects.length === 0) return 0;

  const normalizedBatchSize = Math.max(1, Math.min(batchSize, DELETE_BATCH_LIMIT));
  let deletedCount = 0;

  for (let start = 0; start < orphanedObjects.length; start += normalizedBatchSize) {
    const chunk = orphanedObjects.slice(start, start + normalizedBatchSize);
    const response = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((item) => ({ Key: item.Key })),
          Quiet: true,
        },
      })
    );

    const errors = response.Errors || [];
    if (errors.length > 0) {
      throw new Error(`Failed to delete ${errors.length} CAS objects.`);
    }

    deletedCount += (response.Deleted || []).length;
  }

  return deletedCount;
}

export async function runCasGcOnce(
  graceHours?: number,
  dryRun: boolean = false,
  batchSize?: number
): Promise<any> {
  const bucket = config.S3_BUCKET;
  if (!bucket) {
    logger.info("CAS GC skipped because S3_BUCKET is not configured.");
    return {
      status: "skipped",
      reason: "missing_bucket",
      scanned: 0,
      candidates: 0,
      deleted: 0,
      dry_run: dryRun,
    };
  }

  const effectiveGraceHours = graceHours !== undefined ? graceHours : config.CAS_GC_GRACE_HOURS;
  const effectiveBatchSize = batchSize !== undefined ? batchSize : config.CAS_GC_BATCH_SIZE;

  const { candidates, scanned } = await collectOrphanedObjects(effectiveGraceHours);
  let deleted = 0;

  if (!dryRun && candidates.length > 0) {
    deleted = await deleteOrphanedObjects(candidates, effectiveBatchSize);
  }

  const result = {
    status: "ok",
    bucket,
    prefix: normalizeKeyPrefix(CAS_PREFIX),
    scanned,
    candidates: candidates.length,
    deleted,
    dry_run: dryRun,
    grace_hours: effectiveGraceHours,
  };

  logger.info(`CAS GC completed: ${JSON.stringify(result)}`);
  return result;
}

export function startCasGcLoop(): void {
  const intervalMs = Math.max(60 * 1000, config.CAS_GC_INTERVAL_MINUTES * 60 * 1000);
  
  const loop = async () => {
    try {
      await runCasGcOnce();
    } catch (error) {
      logger.warn(`CAS GC run failed: ${error}`);
    } finally {
      setTimeout(loop, intervalMs);
    }
  };

  if (config.CAS_GC_ENABLED) {
    logger.info(`Starting CAS GC loop with interval: ${config.CAS_GC_INTERVAL_MINUTES} minutes`);
    setTimeout(loop, intervalMs);
  }
}
