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
