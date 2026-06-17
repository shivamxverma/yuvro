from pydantic import BaseModel, Field


class CasGcRunPayload(BaseModel):
    dryRun: bool = False
    graceHours: int | None = Field(default=None, ge=1, le=24 * 365)
    batchSize: int | None = Field(default=None, ge=1, le=1000)


class CasGcRunResponse(BaseModel):
    status: str
    bucket: str | None = None
    prefix: str | None = None
    scanned: int
    candidates: int
    deleted: int
    dry_run: bool
    grace_hours: int | None = None
    reason: str | None = None
