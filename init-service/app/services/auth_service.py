import base64
import hashlib
import hmac
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import requests
from fastapi import HTTPException, Request, Response, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.config import settings
from app.db import session_scope
from app.models.auth import AuthMethod, Session, User


PASSWORD_PROVIDER = "password"
GOOGLE_PROVIDER = "google"
SESSION_ACTIVE = "ACTIVE"
SESSION_REVOKED = "REVOKED"
SESSION_EXPIRED = "EXPIRED"
ACCESS_TOKEN_TYPE = "access"
OAUTH_STATE_TYPE = "oauth_state"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"


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


def _sign(value: str) -> str:
    digest = hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def _encode_signed_payload(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    encoded_payload = base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
    return f"{encoded_payload}.{_sign(encoded_payload)}"


def _decode_signed_payload(token: str, expected_type: str) -> dict[str, Any] | None:
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
    token_type = payload.get("typ")
    if token_type != expected_type:
        return None
    if not isinstance(exp, int) or exp <= int(_now().timestamp()):
        return None
    return payload


def _token_expiry(minutes: int) -> datetime:
    return _now() + timedelta(minutes=minutes)


def _session_expiry(days: int) -> datetime:
    return _now() + timedelta(days=days)


def _generate_access_token(user_id: str, session_id: str) -> tuple[str, datetime]:
    expires_at = _token_expiry(settings.access_token_ttl_minutes)
    token = _encode_signed_payload(
        {
            "sub": user_id,
            "sid": session_id,
            "typ": ACCESS_TOKEN_TYPE,
            "exp": int(expires_at.timestamp()),
        }
    )
    return token, expires_at


def _generate_state_token(origin: str) -> str:
    expires_at = _token_expiry(settings.oauth_state_ttl_minutes)
    return _encode_signed_payload(
        {
            "origin": origin,
            "nonce": secrets.token_urlsafe(16),
            "typ": OAUTH_STATE_TYPE,
            "exp": int(expires_at.timestamp()),
        }
    )


def _hash_refresh_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def _build_refresh_token(session_id: str, secret: str) -> str:
    return f"{session_id}.{secret}"


def _parse_refresh_token(token: str | None) -> tuple[str, str] | None:
    if not token:
        return None
    parts = token.split(".", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0], parts[1]


def _serialize_user(row: User) -> dict:
    return {
        "id": row.id,
        "email": row.email,
        "name": row.name,
    }


def _serialize_session(row: Session, *, current_session_id: str | None = None) -> dict:
    return {
        "id": row.id,
        "userAgent": row.user_agent,
        "ipAddress": row.ip_address,
        "createdAt": row.created_at.isoformat(),
        "updatedAt": row.updated_at.isoformat(),
        "expiresAt": row.expires_at.isoformat(),
        "lastUsedAt": row.last_used_at.isoformat() if row.last_used_at else None,
        "revokedAt": row.revoked_at.isoformat() if row.revoked_at else None,
        "status": row.status,
        "isCurrent": row.id == current_session_id,
    }


def _set_auth_cookie(
    response: Response,
    *,
    key: str,
    value: str,
    expires_at: datetime,
) -> None:
    response.set_cookie(
        key=key,
        value=value,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=max(0, int((expires_at - _now()).total_seconds())),
        expires=expires_at,
        path="/",
    )


def _clear_auth_cookie(response: Response, *, key: str) -> None:
    response.delete_cookie(
        key=key,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    _clear_auth_cookie(response, key=settings.access_cookie_name)
    _clear_auth_cookie(response, key=settings.refresh_cookie_name)


def _set_auth_cookies(response: Response, user_id: str, session_id: str, refresh_token: str, refresh_expires_at: datetime) -> None:
    access_token, access_expires_at = _generate_access_token(user_id, session_id)
    _set_auth_cookie(
        response,
        key=settings.access_cookie_name,
        value=access_token,
        expires_at=access_expires_at,
    )
    _set_auth_cookie(
        response,
        key=settings.refresh_cookie_name,
        value=refresh_token,
        expires_at=refresh_expires_at,
    )


def _extract_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or None
    return request.client.host if request.client else None


def _ensure_google_configured() -> None:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured.",
        )


def _validate_origin(origin: str) -> str:
    normalized = origin.strip().rstrip("/")
    if normalized not in [allowed.rstrip("/") for allowed in settings.allowed_client_origins]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Origin is not allowed.",
        )
    return normalized


def _generate_username_seed(email: str, name: str | None) -> str:
    candidate = (name or email.split("@", 1)[0]).strip().lower()
    sanitized = "".join(ch for ch in candidate if ch.isalnum())
    return sanitized[:16] or "user"


def _generate_unique_name(session, email: str, preferred_name: str | None) -> str:
    seed = _generate_username_seed(email, preferred_name)
    candidate = preferred_name.strip() if preferred_name and preferred_name.strip() else seed
    current_name = candidate
    counter = 0
    while True:
        exists = session.scalar(select(User.id).where(User.name == current_name))
        if not exists:
            return current_name
        counter += 1
        current_name = f"{candidate}-{counter}"


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

        resolved_name = name.strip() if name and name.strip() else _generate_unique_name(session, normalized_email, None)
        user = User(
            id=user_id,
            email=normalized_email,
            name=resolved_name,
            created_at=now,
            updated_at=now,
        )
        auth_method = AuthMethod(
            id=auth_method_id,
            user_id=user_id,
            provider=PASSWORD_PROVIDER,
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
                AuthMethod.provider == PASSWORD_PROVIDER,
                AuthMethod.provider_user_id == normalized_email,
            )
        )

        if not auth_method or not auth_method.password_hash or not _verify_password(password, auth_method.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        return _serialize_user(auth_method.user)


def _create_session_record(user_id: str, *, user_agent: str | None, ip_address: str | None) -> tuple[str, str, datetime]:
    now = _now()
    session_id = str(uuid.uuid4())
    refresh_secret = secrets.token_urlsafe(32)
    refresh_expires_at = _session_expiry(settings.refresh_token_ttl_days)

    with session_scope() as session:
        session.add(
            Session(
                id=session_id,
                user_id=user_id,
                refresh_token_hash=_hash_refresh_secret(refresh_secret),
                status=SESSION_ACTIVE,
                user_agent=user_agent,
                ip_address=ip_address,
                expires_at=refresh_expires_at,
                last_used_at=now,
                revoked_at=None,
                created_at=now,
                updated_at=now,
            )
        )

    return session_id, _build_refresh_token(session_id, refresh_secret), refresh_expires_at


def create_session(response: Response, user_id: str, request: Request) -> None:
    session_id, refresh_token, refresh_expires_at = _create_session_record(
        user_id,
        user_agent=request.headers.get("user-agent"),
        ip_address=_extract_client_ip(request),
    )
    _set_auth_cookies(response, user_id, session_id, refresh_token, refresh_expires_at)


def _revoke_session_by_id(session_id: str) -> None:
    now = _now()
    with session_scope() as session:
        session.execute(
            update(Session)
            .where(Session.id == session_id, Session.status == SESSION_ACTIVE)
            .values(status=SESSION_REVOKED, revoked_at=now, updated_at=now)
        )


def destroy_session(response: Response, request: Request) -> None:
    refresh_cookie = request.cookies.get(settings.refresh_cookie_name)
    parsed = _parse_refresh_token(refresh_cookie)
    if parsed:
        _revoke_session_by_id(parsed[0])
    clear_auth_cookies(response)


def destroy_all_sessions(response: Response, user_id: str) -> None:
    now = _now()
    with session_scope() as session:
        session.execute(
            update(Session)
            .where(Session.user_id == user_id, Session.status == SESSION_ACTIVE)
            .values(status=SESSION_REVOKED, revoked_at=now, updated_at=now)
        )
    clear_auth_cookies(response)


def refresh_session(response: Response, request: Request) -> None:
    parsed = _parse_refresh_token(request.cookies.get(settings.refresh_cookie_name))
    if not parsed:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session.")

    session_id, refresh_secret = parsed
    now = _now()

    error_detail: str | None = None
    with session_scope() as session:
        session_row = session.get(Session, session_id)
        if session_row is None:
            clear_auth_cookies(response)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session.")

        if session_row.status != SESSION_ACTIVE or session_row.revoked_at is not None:
            error_detail = "Session has been revoked."

        elif session_row.expires_at <= now:
            session_row.status = SESSION_EXPIRED
            session_row.updated_at = now
            error_detail = "Session expired."

        provided_hash = _hash_refresh_secret(refresh_secret)
        if error_detail is None and not hmac.compare_digest(provided_hash, session_row.refresh_token_hash):
            session_row.status = SESSION_REVOKED
            session_row.revoked_at = now
            session_row.updated_at = now
            error_detail = "Session has been revoked."

        if error_detail is None:
            next_refresh_secret = secrets.token_urlsafe(32)
            next_refresh_expires_at = _session_expiry(settings.refresh_token_ttl_days)
            session_row.refresh_token_hash = _hash_refresh_secret(next_refresh_secret)
            session_row.last_used_at = now
            session_row.expires_at = next_refresh_expires_at
            session_row.updated_at = now
            user_id = session_row.user_id
        else:
            next_refresh_secret = None
            next_refresh_expires_at = None
            user_id = session_row.user_id

    if error_detail is not None or next_refresh_secret is None or next_refresh_expires_at is None:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_detail or "Invalid session.")

    _set_auth_cookies(
        response,
        user_id,
        session_id,
        _build_refresh_token(session_id, next_refresh_secret),
        next_refresh_expires_at,
    )


def get_current_auth_context(request: Request) -> dict[str, Any]:
    token = request.cookies.get(settings.access_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    payload = _decode_signed_payload(token, ACCESS_TOKEN_TYPE)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    user_id = payload.get("sub")
    session_id = payload.get("sid")
    if not isinstance(user_id, str) or not isinstance(session_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    now = _now()
    with session_scope() as session:
        session_row = session.get(Session, session_id)
        if (
            session_row is None
            or session_row.user_id != user_id
            or session_row.status != SESSION_ACTIVE
            or session_row.expires_at <= now
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

        user = session.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

        return {
            "user": _serialize_user(user),
            "sessionId": session_id,
        }


def get_current_user(request: Request) -> dict:
    return get_current_auth_context(request)["user"]


def list_sessions(user_id: str, current_session_id: str | None) -> dict:
    with session_scope() as session:
        sessions = session.scalars(
            select(Session)
            .where(Session.user_id == user_id)
            .order_by(Session.last_used_at.desc().nullslast(), Session.created_at.desc())
        ).all()
        return {
            "sessions": [
                _serialize_session(row, current_session_id=current_session_id)
                for row in sessions
            ]
        }


def build_google_auth_url(origin: str) -> str:
    _ensure_google_configured()
    validated_origin = _validate_origin(origin)
    state = _generate_state_token(validated_origin)
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        }
    )
    return f"{GOOGLE_AUTH_URL}?{query}"


def verify_oauth_state(state: str) -> dict[str, Any]:
    payload = _decode_signed_payload(state, OAUTH_STATE_TYPE)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state.",
        )
    origin = payload.get("origin")
    if not isinstance(origin, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state.",
        )
    return {"origin": _validate_origin(origin)}


def _exchange_google_code(code: str) -> str:
    _ensure_google_configured()
    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth failed.",
        )
    payload = response.json()
    id_token_value = payload.get("id_token")
    if not isinstance(id_token_value, str) or not id_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth failed.",
        )
    return id_token_value


def _verify_google_id_token(id_token_value: str) -> dict[str, Any]:
    _ensure_google_configured()
    try:
        payload = google_id_token.verify_oauth2_token(
            id_token_value,
            google_requests.Request(),
            settings.google_client_id,
        )
    except Exception as exc:  # pragma: no cover - external verification failure
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth failed.",
        ) from exc

    issuer = payload.get("iss")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth failed.",
        )
    if payload.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email is not verified.",
        )
    return payload


def authenticate_google_user(code: str) -> dict:
    verified_payload = _verify_google_id_token(_exchange_google_code(code))
    google_sub = verified_payload.get("sub")
    email = verified_payload.get("email")
    name = verified_payload.get("name")
    if not isinstance(google_sub, str) or not google_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth failed.",
        )
    normalized_email = _normalize_email(str(email))

    with session_scope() as session:
        existing_google_auth = session.scalar(
            select(AuthMethod)
            .options(joinedload(AuthMethod.user))
            .where(
                AuthMethod.provider == GOOGLE_PROVIDER,
                AuthMethod.provider_user_id == google_sub,
            )
        )
        if existing_google_auth:
            user = existing_google_auth.user
            if user.name != name and isinstance(name, str) and name.strip():
                user.name = name.strip()
                user.updated_at = _now()
            return _serialize_user(user)

        existing_user = session.scalar(select(User).where(User.email == normalized_email))
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ACCOUNT_EXISTS_WITH_DIFFERENT_SIGNIN_METHOD",
            )

        now = _now()
        user = User(
            id=str(uuid.uuid4()),
            email=normalized_email,
            name=(name.strip() if isinstance(name, str) and name.strip() else _generate_unique_name(session, normalized_email, None)),
            created_at=now,
            updated_at=now,
        )
        auth_method = AuthMethod(
            id=str(uuid.uuid4()),
            user_id=user.id,
            provider=GOOGLE_PROVIDER,
            provider_user_id=google_sub,
            password_hash=None,
            created_at=now,
        )
        session.add(user)
        session.add(auth_method)
        session.flush()
        return _serialize_user(user)
