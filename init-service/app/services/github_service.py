import os
import tempfile
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from app.config import settings
import boto3

s3_client = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id or None,
    aws_secret_access_key=settings.aws_secret_access_key or None,
    endpoint_url=settings.s3_endpoint or None,
)


def _upload_directory_to_s3(local_dir: str, s3_prefix: str, bucket: str) -> int:
    """Recursively upload a local directory to an S3 prefix. Returns file count."""
    upload_tasks = []
    for root, dirs, files in os.walk(local_dir):
        # Skip .git directory entirely
        dirs[:] = [d for d in dirs if d != ".git"]
        for filename in files:
            local_path = os.path.join(root, filename)
            relative_path = os.path.relpath(local_path, local_dir)
            # Use forward slashes for S3 keys
            s3_key = f"{s3_prefix}/{relative_path.replace(os.sep, '/')}"
            upload_tasks.append((local_path, s3_key))

    def _upload_one(task):
        local_path, s3_key = task
        print(f"Uploading {local_path} -> s3://{bucket}/{s3_key}")
        s3_client.upload_file(local_path, bucket, s3_key)

    with ThreadPoolExecutor(max_workers=10) as executor:
        executor.map(_upload_one, upload_tasks)

    return len(upload_tasks)


def clone_github_and_upload(github_url: str, repl_id: str) -> dict:
    """
    Clone a public GitHub repository into a temp directory,
    upload all files to S3 under yuvro/code/{repl_id}/,
    and also copy them directly to the local workspaces directory on the host filesystem.
    """
    bucket = settings.s3_bucket
    tmp_dir = tempfile.mkdtemp(prefix="yuvro_clone_")
    try:
        # git clone into tmp_dir/repo
        clone_target = os.path.join(tmp_dir, "repo")
        print(f"[Clone] Cloning {github_url} into {clone_target} ...")
        result = subprocess.run(
            ["git", "clone", "--depth", "1", github_url, clone_target],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"git clone failed: {result.stderr.strip() or result.stdout.strip()}"
            )
        print("[Clone] Clone successful.")

        # Try Upload to S3
        uploaded_count = 0
        s3_prefix = f"yuvro/code/{repl_id}"
        if bucket:
            try:
                uploaded_count = _upload_directory_to_s3(clone_target, s3_prefix, bucket)
                print(f"[Clone] Uploaded {uploaded_count} files to s3://{bucket}/{s3_prefix}/")
            except Exception as e:
                print(f"[Clone] Warning: S3 upload failed: {e}")
        else:
            print("[Clone] S3_BUCKET is not configured, skipping S3 upload.")

        # Local fallback/sync copy to spaces dir on the host
        local_workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../workspaces", repl_id))
        os.makedirs(local_workspace_dir, exist_ok=True)
        
        local_files_copied = 0
        for item in os.listdir(clone_target):
            s = os.path.join(clone_target, item)
            d = os.path.join(local_workspace_dir, item)
            if os.path.isdir(s):
                if item != ".git":
                    shutil.copytree(s, d, dirs_exist_ok=True)
                    local_files_copied += 1
            else:
                shutil.copy2(s, d)
                local_files_copied += 1
                
        print(f"[Clone] Copied cloned project files directly to local workspace directory: {local_workspace_dir}")
        return {
            "status": "cloned",
            "files_uploaded": uploaded_count,
            "s3_prefix": s3_prefix if bucket else "",
            "local_files_copied": local_files_copied
        }

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(f"[Clone] Cleaned up temp directory {tmp_dir}")
