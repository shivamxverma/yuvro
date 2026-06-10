import os
import shutil
from app.services.s3_service import copy_s3_folder
from app.services.github_service import clone_github_and_upload

def create_project(repl_id: str, language: str):
    # Try S3 copy first
    try:
        copy_s3_folder(f"yuvro/base/{language}", f"yuvro/code/{repl_id}")
    except Exception as e:
        print(f"[create_project] S3 copy failed/skipped: {e}")

    # Local sync / fallback: Copy templates directly from local runner/templates directory
    # relative to init-service folder
    local_workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../workspaces", repl_id))
    local_template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../runner/templates", language))
    
    if os.path.exists(local_template_dir):
        os.makedirs(local_workspace_dir, exist_ok=True)
        shutil.copytree(local_template_dir, local_workspace_dir, dirs_exist_ok=True)
        print(f"[create_project] Copied local template from {local_template_dir} to {local_workspace_dir}")
    else:
        print(f"[create_project] Warning: Local template folder {local_template_dir} does not exist.")

    return "Project created"

def clone_project(repl_id: str, github_url: str):
    result = clone_github_and_upload(github_url, repl_id)
    return {"message": "Project cloned successfully", **result}
