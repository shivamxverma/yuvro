import base64
import hashlib
import hmac
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.config import settings
from app.db import session_scope
from app.models.auth import AuthMethod, User


def _now() -> datetime:
    return datetime.now(UTC)


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A valid email address is required.",
        )
    return normalized


def _hash_password(password: str) -> str:
    iterations = 240000
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        iterations,
    )
    return f"pbkdf2_sha256${iterations}${salt}${derived.hex()}"


def _verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_str, salt, digest = encoded.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        int(iterations_str),
    )
    return hmac.compare_digest(derived.hex(), digest)


def _token_expiry() -> datetime:
    return _now() + timedelta(days=settings.auth_token_ttl_days)


def _sign(value: str) -> str:
    digest = hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def _encode_token(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    encoded_payload = base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
    return f"{encoded_payload}.{_sign(encoded_payload)}"


def _decode_token(token: str) -> dict | None:
    try:
        encoded_payload, signature = token.split(".", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(signature, _sign(encoded_payload)):
        return None
    padding = "=" * (-len(encoded_payload) % 4)
    try:
        raw = base64.urlsafe_b64decode(encoded_payload + padding)
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        return None
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp <= int(_now().timestamp()):
        return None
    return payload


def _serialize_user(row: User) -> dict:
    return {
        "id": row.id,
        "email": row.email,
        "name": row.name,
    }


def _set_auth_cookie(response: Response, token: str, expires_at: datetime) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=int((expires_at - _now()).total_seconds()),
        expires=expires_at,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


def create_user(email: str, password: str, name: str | None) -> dict:
    normalized_email = _normalize_email(email)
    password_hash = _hash_password(password)
    now = _now()
    user_id = str(uuid.uuid4())
    auth_method_id = str(uuid.uuid4())

    with session_scope() as session:
        existing = session.scalar(select(User.id).where(User.email == normalized_email))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )

        user = User(
            id=user_id,
            email=normalized_email,
            name=name.strip() if name else None,
            created_at=now,
            updated_at=now,
        )
        auth_method = AuthMethod(
            id=auth_method_id,
            user_id=user_id,
            provider="password",
            provider_user_id=normalized_email,
            password_hash=password_hash,
            created_at=now,
        )
        session.add(user)
        session.add(auth_method)
        try:
            session.flush()
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            ) from None

    return _serialize_user(user)


def authenticate_user(email: str, password: str) -> dict:
    normalized_email = _normalize_email(email)
    with session_scope() as session:
        auth_method = session.scalar(
            select(AuthMethod)
            .options(joinedload(AuthMethod.user))
            .where(
                AuthMethod.provider == "password",
                AuthMethod.provider_user_id == normalized_email,
            )
        )

    if not auth_method or not auth_method.password_hash or not _verify_password(password, auth_method.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    return _serialize_user(auth_method.user)


def create_session(response: Response, user_id: str) -> None:
    expires_at = _token_expiry()
    token = _encode_token(
        {
            "sub": user_id,
            "exp": int(expires_at.timestamp()),
        }
    )
    _set_auth_cookie(response, token, expires_at)


def destroy_session(response: Response, request: Request) -> None:
    _clear_auth_cookie(response)


def get_current_user(request: Request, touch_session: bool = True) -> dict:
    del touch_session
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    payload = _decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    with session_scope() as session:
        user = session.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    return _serialize_user(user)
