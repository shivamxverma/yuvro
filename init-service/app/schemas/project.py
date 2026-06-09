from pydantic import BaseModel, Field

class ProjectCreate(BaseModel):
    replId: str = Field(..., description="The unique ID of the Repl project.")
    language: str = Field(..., description="The programming language/template of the project (e.g., 'python', 'nodejs').")
