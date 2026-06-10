from pydantic import BaseModel, Field

class ProjectCreate(BaseModel):
    replId: str = Field(..., description="The unique ID of the Repl project.")
    language: str = Field(..., description="The programming language/template of the project (e.g., 'python', 'nodejs').")

class GitCloneCreate(BaseModel):
    replId: str = Field(..., description="The unique ID to assign to this cloned project.")
    githubUrl: str = Field(..., description="The public GitHub repository URL to clone (e.g. https://github.com/user/repo).")
