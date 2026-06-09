import os
import asyncio
import boto3
from botocore.exceptions import NoCredentialsError, PartialCredentialsError

S3_BUCKET = os.getenv("S3_BUCKET", "")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
S3_ENDPOINT = os.getenv("S3_ENDPOINT")

s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    endpoint_url=S3_ENDPOINT
)

import shutil

def _upload_sync(key: str, file_path: str, content: str) -> None:

    if file_path.startswith("/"):
        s3_key = f"{key}{file_path}"
    else:
        s3_key = f"{key}/{file_path}"

    try:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=content.encode("utf-8")
        )
        print(f"Successfully backed up {file_path} to S3 Key: {s3_key}")
    except (NoCredentialsError, PartialCredentialsError):
        print(f"[Warning] AWS Credentials not configured. Skipping S3 backup for {file_path}.")

    except Exception as e:
        print(f"[Error] Failed to save {file_path} to S3: {e}")
    
async def save_to_s3(key: str, file_path: str, content: str) -> None:
    await asyncio.to_thread(_upload_sync, key, file_path, content)

def _download_sync(key: str, local_dir: str) -> None:
    try:
        if os.path.exists(local_dir):
            shutil.rmtree(local_dir)
        os.makedirs(local_dir, exist_ok=True)

        bucket = S3_BUCKET
        if not bucket:
            print("[Error] S3_BUCKET is not configured.")
            return

        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket, Prefix=key)

        for page in pages:
            for obj in page.get('Contents', []):
                s3_key = obj['Key']
                rel_path = s3_key[len(key):].lstrip('/')
                if not rel_path:
                    continue
                
                local_file_path = os.path.join(local_dir, rel_path)
                os.makedirs(os.path.dirname(local_file_path), exist_ok=True)
                
                print(f"Downloading {s3_key} -> {local_file_path}...")
                s3_client.download_file(bucket, s3_key, local_file_path)
                print(f"Downloaded {rel_path}")
    except Exception as e:
        print(f"[Error] Failed to download from S3: {e}")
        raise e

async def download_from_s3(key: str, local_dir: str) -> None:
    await asyncio.to_thread(_download_sync, key, local_dir)

