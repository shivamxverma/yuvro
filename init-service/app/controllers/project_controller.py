from app.services.s3_service import copy_s3_folder
from app.services.github_service import clone_github_and_upload

def create_project(repl_id: str, language: str):
    copy_s3_folder(f"yuvro/base/{language}", f"yuvro/code/{repl_id}")
    return "Project created"

def clone_project(repl_id: str, github_url: str):
    result = clone_github_and_upload(github_url, repl_id)
    return {"message": "Project cloned successfully", **result}
