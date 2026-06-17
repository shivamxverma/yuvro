from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import settings
from app.schemas.admin import CasGcRunPayload, CasGcRunResponse
from app.services.cas_gc_service import run_cas_gc_once


router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    if not settings.admin_api_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API token is not configured.",
        )
    if x_admin_token != settings.admin_api_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin token.",
        )


@router.post("/cas-gc", response_model=CasGcRunResponse)
def run_cas_gc_route(payload: CasGcRunPayload, _: None = Depends(require_admin_token)):
    del _
    return run_cas_gc_once(
        grace_hours=payload.graceHours,
        batch_size=payload.batchSize,
        dry_run=payload.dryRun,
    )
