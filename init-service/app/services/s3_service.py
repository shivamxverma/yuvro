import boto3
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
from app.config import settings

s3_client = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id or None,
    aws_secret_access_key=settings.aws_secret_access_key or None,
    endpoint_url=settings.s3_endpoint or None,
)

def copy_s3_folder(source_prefix: str, destination_prefix: str, continuation_token: Optional[str] = None) -> None:
    """
    Recursively copies files from a source prefix to a destination prefix in S3.
    Matches the Node.js implementation by copying files concurrently.
    """
    try:
        bucket = settings.s3_bucket
        if not bucket:
            print("S3_BUCKET environment variable is not configured.")
            return

        list_params = {
            "Bucket": bucket,
            "Prefix": source_prefix,
        }
        if continuation_token:
            list_params["ContinuationToken"] = continuation_token

        response = s3_client.list_objects_v2(**list_params)
        contents = response.get("Contents", [])
        if not contents:
            print(f"No contents found under S3 prefix: {source_prefix}")
            return

        def copy_single_object(obj):
            key = obj.get("Key")
            if not key:
                return
            
            destination_key = key.replace(source_prefix, destination_prefix, 1)
            copy_source = {"Bucket": bucket, "Key": key}
            
            print(f"Copying {key} -> {destination_key}...")
            s3_client.copy_object(
                Bucket=bucket,
                CopySource=copy_source,
                Key=destination_key
            )
            print(f"Copied {key} to {destination_key}")


        with ThreadPoolExecutor(max_workers=10) as executor:
            executor.map(copy_single_object, contents)

        if response.get("IsTruncated"):
            next_token = response.get("NextContinuationToken")
            copy_s3_folder(source_prefix, destination_prefix, next_token)

    except Exception as e:
        print(f"Error copying folder from S3: {e}")
        raise e
