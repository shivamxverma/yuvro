from fastapi import APIRouter, HTTPException, status
from app.schemas.project import ProjectCreate, GitCloneCreate
from app.controllers import project_controller
from app.routes.auth import require_current_user
from fastapi import Depends

router = APIRouter()

@router.post("/project", status_code=status.HTTP_200_OK)
def create_project_route(payload: ProjectCreate, user: dict = Depends(require_current_user)):
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
        return project_controller.create_project(user["id"], repl_id, language)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )

@router.post("/clone", status_code=status.HTTP_200_OK)
def clone_project_route(payload: GitCloneCreate, user: dict = Depends(require_current_user)):
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
        return project_controller.clone_project(user["id"], repl_id, github_url)
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
