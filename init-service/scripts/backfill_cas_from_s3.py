#!/usr/bin/env python3
import argparse
import os
import sys

import boto3
from botocore.exceptions import BotoCoreError, ClientError


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.config import settings
from app.services.cas_service import CAS_PREFIX, hash_content, object_key, upload_if_missing


def _build_s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
        endpoint_url=settings.s3_endpoint or None,
    )


def _iter_source_objects(s3_client, bucket: str, prefix: str):
    paginator = s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj.get("Key")
            if not key:
                continue
            yield key


def _should_skip_key(key: str, source_prefix: str) -> bool:
    normalized_prefix = source_prefix.rstrip("/")
    cas_prefix = CAS_PREFIX.rstrip("/") + "/"
    if not normalized_prefix:
        return key.startswith(cas_prefix)
    return key == normalized_prefix or key.startswith(cas_prefix)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill content-addressed S3 objects from an existing path-based S3 prefix."
    )
    parser.add_argument(
        "--bucket",
        default=settings.s3_bucket,
        help="Bucket name. Defaults to S3_BUCKET from the environment.",
    )
    parser.add_argument(
        "--prefix",
        required=True,
        help="Source prefix to scan, for example yuvro/code/<repl_id>/",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute hashes and print intended CAS keys without uploading.",
    )
    args = parser.parse_args()

    if not args.bucket:
        print("Missing bucket. Set S3_BUCKET or pass --bucket.", file=sys.stderr)
        return 1

    s3_client = _build_s3_client()
    scanned = 0
    uploaded = 0
    skipped = 0

    try:
        for key in _iter_source_objects(s3_client, args.bucket, args.prefix):
            if _should_skip_key(key, args.prefix):
                skipped += 1
                continue

            scanned += 1
            response = s3_client.get_object(Bucket=args.bucket, Key=key)
            content = response["Body"].read()
            content_hash = hash_content(content)
            cas_key = object_key(content_hash)

            if args.dry_run:
                print(f"DRY RUN {key} -> {cas_key}")
                continue

            upload_if_missing(content_hash, content)
            uploaded += 1
            print(f"BACKFILLED {key} -> {cas_key}")
    except (BotoCoreError, ClientError, OSError) as exc:
        print(f"Backfill failed: {exc}", file=sys.stderr)
        return 1

    print(
        f"Done. scanned={scanned} uploaded={uploaded} skipped={skipped} bucket={args.bucket} prefix={args.prefix}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
