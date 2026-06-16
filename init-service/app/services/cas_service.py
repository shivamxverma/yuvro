import hashlib
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError, EndpointConnectionError

from app.config import settings


logger = logging.getLogger(__name__)
_storage_disabled = False
CAS_PREFIX = "yuvro/CAS"
READ_CHUNK_SIZE = 1024 * 1024

s3_client = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id or None,
    aws_secret_access_key=settings.aws_secret_access_key or None,
    endpoint_url=settings.s3_endpoint or None,
)


def hash_content(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def hash_file(file_path: str) -> tuple[str, int]:
    digest = hashlib.sha256()
    size_bytes = 0

    with open(file_path, "rb") as handle:
        for chunk in iter(lambda: handle.read(READ_CHUNK_SIZE), b""):
            digest.update(chunk)
            size_bytes += len(chunk)

    return digest.hexdigest(), size_bytes


def object_key(content_hash: str) -> str:
    return f"{CAS_PREFIX}/{content_hash[:2]}/{content_hash}"


def _disable_storage(reason: str) -> None:
    global _storage_disabled
    if _storage_disabled:
        return
    _storage_disabled = True
    logger.warning("Disabling CAS uploads for this process: %s", reason)


def upload_if_missing(content_hash: str, content: bytes) -> None:
    global _storage_disabled

    bucket = settings.s3_bucket
    if not bucket or _storage_disabled:
        return

    key = object_key(content_hash)
    try:
        s3_client.head_object(Bucket=bucket, Key=key)
        return
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code not in {"404", "NoSuchKey", "NotFound"}:
            raise
    except (EndpointConnectionError, BotoCoreError, OSError) as exc:
        _disable_storage(str(exc))
        return

    try:
        s3_client.put_object(Bucket=bucket, Key=key, Body=content)
    except (EndpointConnectionError, BotoCoreError, OSError) as exc:
        _disable_storage(str(exc))


def upload_file_if_missing(content_hash: str, file_path: str) -> None:
    global _storage_disabled

    bucket = settings.s3_bucket
    if not bucket or _storage_disabled:
        return

    key = object_key(content_hash)
    try:
        s3_client.head_object(Bucket=bucket, Key=key)
        return
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code not in {"404", "NoSuchKey", "NotFound"}:
            raise
    except (EndpointConnectionError, BotoCoreError, OSError) as exc:
        _disable_storage(str(exc))
        return

    try:
        with open(file_path, "rb") as handle:
            s3_client.put_object(Bucket=bucket, Key=key, Body=handle)
    except (EndpointConnectionError, BotoCoreError, OSError) as exc:
        _disable_storage(str(exc))
