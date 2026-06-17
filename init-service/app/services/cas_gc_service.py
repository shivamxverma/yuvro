import asyncio
import logging
from datetime import UTC, datetime, timedelta

from botocore.exceptions import BotoCoreError, ClientError, EndpointConnectionError
from sqlalchemy import select

from app.config import settings
from app.db import session_scope
from app.models.project import Node
from app.services.cas_service import CAS_PREFIX, s3_client


logger = logging.getLogger(__name__)
DELETE_BATCH_LIMIT = 1000


def _normalize_key_prefix(prefix: str) -> str:
    return prefix.rstrip("/") + "/"


def _extract_hash_from_key(key: str) -> str | None:
    prefix = _normalize_key_prefix(CAS_PREFIX)
    if not key.startswith(prefix):
        return None

    parts = key[len(prefix) :].split("/")
    if len(parts) != 2:
        return None

    shard, content_hash = parts
    if len(shard) != 2 or len(content_hash) != 64:
        return None
    if content_hash[:2] != shard:
        return None
    return content_hash


def get_live_content_hashes() -> set[str]:
    with session_scope() as session:
        rows = session.scalars(
            select(Node.content_hash).where(Node.content_hash.is_not(None)).distinct()
        ).all()
    return {content_hash for content_hash in rows if content_hash}


def collect_orphaned_objects(*, grace_hours: int) -> tuple[list[dict[str, object]], int]:
    bucket = settings.s3_bucket
    if not bucket:
        return [], 0

    live_hashes = get_live_content_hashes()
    prefix = _normalize_key_prefix(CAS_PREFIX)
    grace_cutoff = datetime.now(UTC) - timedelta(hours=grace_hours)
    paginator = s3_client.get_paginator("list_objects_v2")

    candidates: list[dict[str, object]] = []
    scanned = 0

    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj.get("Key")
            if not key:
                continue
            scanned += 1

            content_hash = _extract_hash_from_key(key)
            if not content_hash or content_hash in live_hashes:
                continue

            last_modified = obj.get("LastModified")
            if last_modified is None or last_modified > grace_cutoff:
                continue

            candidates.append(
                {
                    "Key": key,
                    "hash": content_hash,
                    "last_modified": last_modified,
                    "size": obj.get("Size", 0),
                }
            )

    return candidates, scanned


def delete_orphaned_objects(orphaned_objects: list[dict[str, object]], *, batch_size: int) -> int:
    bucket = settings.s3_bucket
    if not bucket or not orphaned_objects:
        return 0

    normalized_batch_size = max(1, min(batch_size, DELETE_BATCH_LIMIT))
    deleted = 0

    for start in range(0, len(orphaned_objects), normalized_batch_size):
        chunk = orphaned_objects[start : start + normalized_batch_size]
        response = s3_client.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": str(item["Key"])} for item in chunk], "Quiet": True},
        )
        errors = response.get("Errors", [])
        if errors:
            raise RuntimeError(f"Failed to delete {len(errors)} CAS objects: {errors}")
        deleted += len(response.get("Deleted", []))

    return deleted


def run_cas_gc_once(*, grace_hours: int | None = None, dry_run: bool = False, batch_size: int | None = None) -> dict:
    bucket = settings.s3_bucket
    if not bucket:
        logger.info("CAS GC skipped because S3_BUCKET is not configured.")
        return {
            "status": "skipped",
            "reason": "missing_bucket",
            "scanned": 0,
            "candidates": 0,
            "deleted": 0,
            "dry_run": dry_run,
        }

    effective_grace_hours = grace_hours if grace_hours is not None else settings.cas_gc_grace_hours
    effective_batch_size = batch_size if batch_size is not None else settings.cas_gc_batch_size

    orphaned_objects, scanned = collect_orphaned_objects(grace_hours=effective_grace_hours)
    deleted = 0
    if not dry_run and orphaned_objects:
        deleted = delete_orphaned_objects(orphaned_objects, batch_size=effective_batch_size)

    result = {
        "status": "ok",
        "bucket": bucket,
        "prefix": _normalize_key_prefix(CAS_PREFIX),
        "scanned": scanned,
        "candidates": len(orphaned_objects),
        "deleted": deleted,
        "dry_run": dry_run,
        "grace_hours": effective_grace_hours,
    }
    logger.info("CAS GC completed: %s", result)
    return result


async def cas_gc_loop() -> None:
    interval_seconds = max(60, settings.cas_gc_interval_minutes * 60)
    while True:
        try:
            await asyncio.to_thread(run_cas_gc_once)
        except (BotoCoreError, ClientError, EndpointConnectionError, OSError, RuntimeError) as exc:
            logger.warning("CAS GC run failed: %s", exc)
        except Exception:
            logger.exception("CAS GC loop crashed unexpectedly.")
        await asyncio.sleep(interval_seconds)
