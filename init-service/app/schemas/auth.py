from pydantic import BaseModel, Field


class AuthUser(BaseModel):
    id: str
    email: str
    displayName: str | None = None


class SignUpPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=256)
    displayName: str | None = Field(default=None, max_length=120)


class SignInPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=256)


class AuthResponse(BaseModel):
    user: AuthUser
