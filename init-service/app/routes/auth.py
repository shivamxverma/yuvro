from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import RedirectResponse

from app.config import settings
from app.schemas.auth import (
    AuthResponse,
    AuthUser,
    SessionListResponse,
    SignInPayload,
    SignUpPayload,
    StatusResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def require_current_user(request: Request) -> dict:
    return auth_service.get_current_user(request)


def require_current_auth(request: Request) -> dict:
    return auth_service.get_current_auth_context(request)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def sign_up(payload: SignUpPayload, request: Request, response: Response):
    user = auth_service.create_user(payload.email, payload.password, payload.name)
    auth_service.create_session(response, user["id"], request)
    return {"user": user}


@router.post("/signin", response_model=AuthResponse)
def sign_in(payload: SignInPayload, request: Request, response: Response):
    user = auth_service.authenticate_user(payload.email, payload.password)
    auth_service.create_session(response, user["id"], request)
    return {"user": user}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(request: Request, response: Response):
    auth_service.destroy_session(response, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout-all", response_model=StatusResponse)
def sign_out_all(response: Response, auth: dict = Depends(require_current_auth)):
    auth_service.destroy_all_sessions(response, auth["user"]["id"])
    return {"ok": True}


@router.post("/refresh", response_model=StatusResponse)
def refresh_auth(request: Request, response: Response):
    auth_service.refresh_session(response, request)
    return {"ok": True}


@router.get("/me", response_model=AuthResponse)
def me(user: dict = Depends(require_current_user)):
    return {"user": AuthUser(**user)}


@router.get("/sessions", response_model=SessionListResponse)
def get_sessions(auth: dict = Depends(require_current_auth)):
    return auth_service.list_sessions(auth["user"]["id"], auth.get("sessionId"))


@router.get("/google")
def initiate_google_auth(origin: str):
    redirect_url = auth_service.build_google_auth_url(origin)
    return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)


@router.get("/google/callback")
def google_auth_callback(request: Request, code: str | None = None, state: str | None = None):
    callback_origin = settings.default_client_origin.rstrip("/")

    if state:
        try:
            callback_origin = auth_service.verify_oauth_state(state)["origin"].rstrip("/")
        except Exception:
            callback_origin = settings.default_client_origin.rstrip("/")

    if not code or not state:
        return RedirectResponse(
            url=f"{callback_origin}/?{urlencode({'authError': 'oauth_failed'})}",
            status_code=status.HTTP_302_FOUND,
        )

    try:
        verified_state = auth_service.verify_oauth_state(state)
        callback_origin = verified_state["origin"].rstrip("/")
        user = auth_service.authenticate_google_user(code)
        redirect = RedirectResponse(
            url=f"{callback_origin}/oauth-success",
            status_code=status.HTTP_302_FOUND,
        )
        auth_service.create_session(redirect, user["id"], request)
        return redirect
    except Exception as exc:
        error_code = "oauth_failed"
        detail = getattr(exc, "detail", "")
        if detail == "ACCOUNT_EXISTS_WITH_DIFFERENT_SIGNIN_METHOD":
            error_code = "account_exists_different_signin_method"
        return RedirectResponse(
            url=f"{callback_origin}/?{urlencode({'authError': error_code})}",
            status_code=status.HTTP_302_FOUND,
        )
