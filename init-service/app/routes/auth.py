from fastapi import APIRouter, Depends, Request, Response, status

from app.schemas.auth import AuthResponse, AuthUser, SignInPayload, SignUpPayload
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def require_current_user(request: Request) -> dict:
    return auth_service.get_current_user(request)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def sign_up(payload: SignUpPayload, response: Response):
    user = auth_service.create_user(payload.email, payload.password, payload.displayName)
    auth_service.create_session(response, user["id"])
    return {"user": user}


@router.post("/signin", response_model=AuthResponse)
def sign_in(payload: SignInPayload, response: Response):
    user = auth_service.authenticate_user(payload.email, payload.password)
    auth_service.create_session(response, user["id"])
    return {"user": user}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(request: Request, response: Response):
    auth_service.destroy_session(response, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=AuthResponse)
def me(user: dict = Depends(require_current_user)):
    return {"user": AuthUser(**user)}
