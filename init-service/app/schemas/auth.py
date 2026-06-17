from pydantic import BaseModel, Field


class AuthUser(BaseModel):
    id: str
    email: str
    name: str | None = None


class SignUpPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=256)
    name: str | None = Field(default=None, max_length=120)


class SignInPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=256)


class AuthResponse(BaseModel):
    user: AuthUser


class StatusResponse(BaseModel):
    ok: bool = True


class SessionSummary(BaseModel):
    id: str
    userAgent: str | None = None
    ipAddress: str | None = None
    createdAt: str
    updatedAt: str
    expiresAt: str
    lastUsedAt: str | None = None
    revokedAt: str | None = None
    status: str
    isCurrent: bool


class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]
