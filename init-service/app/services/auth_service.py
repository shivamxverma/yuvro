import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.config import settings
from app.db import session_scope
from app.models.auth import AuthIdentity, AuthSession, User


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


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _session_expiry() -> datetime:
    return _now() + timedelta(days=settings.auth_session_ttl_days)


def _serialize_user(row) -> dict:
    return {
        "id": row.id,
        "email": row.email,
        "displayName": row.display_name,
    }


def _set_session_cookie(response: Response, token: str, expires_at: datetime) -> None:
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


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


def create_user(email: str, password: str, display_name: str | None) -> dict:
    normalized_email = _normalize_email(email)
    password_hash = _hash_password(password)
    now = _now()
    user_id = str(uuid.uuid4())
    identity_id = str(uuid.uuid4())

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
            display_name=display_name,
            created_at=now,
            updated_at=now,
        )
        identity = AuthIdentity(
            id=identity_id,
            user_id=user_id,
            provider="password",
            provider_subject=normalized_email,
            password_hash=password_hash,
            created_at=now,
        )
        session.add(user)
        session.add(identity)
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
        identity = session.scalar(
            select(AuthIdentity)
            .options(joinedload(AuthIdentity.user))
            .where(
                AuthIdentity.provider == "password",
                AuthIdentity.provider_subject == normalized_email,
            )
        )

    if not identity or not identity.password_hash or not _verify_password(password, identity.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    return _serialize_user(identity.user)


def create_session(response: Response, user_id: str) -> None:
    session_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    token_hash = _hash_session_token(token)
    now = _now()
    expires_at = _session_expiry()

    with session_scope() as session:
        session.add(
            AuthSession(
                id=session_id,
                user_id=user_id,
                token_hash=token_hash,
                created_at=now,
                expires_at=expires_at,
                last_seen_at=now,
            )
        )

    _set_session_cookie(response, token, expires_at)


def destroy_session(response: Response, request: Request) -> None:
    token = request.cookies.get(settings.auth_cookie_name)
    if token:
        token_hash = _hash_session_token(token)
        with session_scope() as session:
            auth_session = session.scalar(
                select(AuthSession).where(AuthSession.token_hash == token_hash)
            )
            if auth_session:
                session.delete(auth_session)
    _clear_session_cookie(response)


def get_current_user(request: Request, touch_session: bool = True) -> dict:
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    token_hash = _hash_session_token(token)
    now = _now()

    with session_scope() as session:
        auth_session = session.scalar(
            select(AuthSession)
            .options(joinedload(AuthSession.user))
            .where(AuthSession.token_hash == token_hash)
        )

        if not auth_session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

        if auth_session.expires_at <= now:
            session.delete(auth_session)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired.",
            )

        if touch_session:
            auth_session.last_seen_at = now

    return _serialize_user(auth_session.user)
