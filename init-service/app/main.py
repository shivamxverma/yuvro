from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.schemas.project import ProjectCreate, GitCloneCreate
from app.services.s3_service import copy_s3_folder
from app.services.github_service import clone_github_and_upload

app = FastAPI(
    title="init-service",
    description="Python FastAPI version of init-service for repl.io",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

@app.post("/project", status_code=status.HTTP_200_OK)
def create_project(payload: ProjectCreate):
    """
    Endpoint to initialize a new project by copying templates inside S3.
    """
    repl_id = payload.replId
    language = payload.language

    if not repl_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="replId cannot be empty"
        )

    try:
        copy_s3_folder(f"yuvro/base/{language}", f"yuvro/code/{repl_id}")
        return "Project created"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )

@app.post("/clone", status_code=status.HTTP_200_OK)
def clone_project(payload: GitCloneCreate):
    """
    Clone a public GitHub repository and store it in S3 as a new project.
    """
    repl_id = payload.replId.strip()
    github_url = payload.githubUrl.strip()

    if not repl_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="replId cannot be empty"
        )
    if not github_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="githubUrl cannot be empty"
        )
    if not (github_url.startswith("https://github.com/") or github_url.startswith("http://github.com/") or github_url.startswith("git@github.com:")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only GitHub URLs are supported (https://github.com/...)"
        )

    try:
        result = clone_github_and_upload(github_url, repl_id)
        return {"message": "Project cloned successfully", **result}
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clone project: {str(e)}"
        )
