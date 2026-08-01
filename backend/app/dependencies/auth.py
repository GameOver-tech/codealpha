"""Auth dependencies — JWT verification + role-based access control.

Every protected endpoint treats the bearer token as untrusted until it is
verified against Supabase Auth (JWKS/HS256). The matching ``users`` row is
loaded (and auto-provisioned on first request, including the admin role
inherited from the legacy ``profiles`` table used by seed_admin.py).
"""
from __future__ import annotations

import time
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import verify_jwt
from app.core.supabase_client import get_supabase_service
from app.models.user import User, UserRole
from app.repositories.user import UserRepository

logger = get_logger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

# Short-lived cache: JWT subject -> (fetched_at, User). Avoids a remote DB
# round-trip on every single request (the DB is a hosted Supabase instance
# with ~3s round-trip latency). Role/active-flag changes propagate within
# the TTL — call invalidate_user_cache() after writes that change those
# fields. 120s balances freshness with the cost of a remote round-trip.
_user_cache: dict[str, tuple[float, User]] = {}
USER_CACHE_TTL_SECONDS = 120.0


def invalidate_user_cache(auth_uid: str | None) -> None:
    if auth_uid:
        _user_cache.pop(auth_uid, None)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Verify the JWT and return the matching User row (auto-provisioning)."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = verify_jwt(credentials.credentials)

    auth_uid: str = payload.get("sub") or payload.get("id")
    if not auth_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    now = time.monotonic()
    cached = _user_cache.get(auth_uid)
    if cached is not None and now - cached[0] < USER_CACHE_TTL_SECONDS:
        user = cached[1]
        if user.is_active:
            return user
        _user_cache.pop(auth_uid, None)

    repo = UserRepository(db)
    user = await repo.get_by_auth_uid(auth_uid)

    if user is None:
        user = await _provision_user(db, auth_uid, payload)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    _user_cache[auth_uid] = (now, user)
    return user


async def _provision_user(db: AsyncSession, auth_uid: str, payload: dict) -> User:
    """Create a users row on first request, deriving role + name from claims.

    Legacy support: if a ``profiles`` row (created by seed_admin.py) exists
    with role='admin', the new users row inherits the admin role.
    """
    metadata = payload.get("user_metadata") or {}
    email = payload.get("email") or ""
    role = UserRole.CANDIDATE

    try:
        sb = get_supabase_service()
        profile_resp = (
            sb.table("profiles")
            .select("role")
            .eq("id", auth_uid)
            .maybe_single()
            .execute()
        )
        profile = profile_resp.data if profile_resp else None
        if profile and profile.get("role") == "admin":
            role = UserRole.ADMIN
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not check legacy profiles table: %s", exc)

    first_name = metadata.get("first_name") or metadata.get("full_name", "").split()[0] if metadata.get("full_name") else ""
    last_name = metadata.get("last_name") or (
        " ".join(metadata.get("full_name", "").split()[1:]) if metadata.get("full_name") else ""
    )

    user = User(
        email=email.lower().strip() if email else str(auth_uid),
        first_name=first_name or "",
        last_name=last_name or "",
        role=role,
        auth_uid=uuid.UUID(auth_uid) if _is_uuid(auth_uid) else None,
        password_hash=None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Auto-provisioned user %s with role %s", user.id, role.value)
    return user


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def require_role(*roles: UserRole | str):
    """Dependency factory — restrict an endpoint to one or more roles."""
    allowed = {r.value if isinstance(r, UserRole) else r for r in roles}

    async def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of these roles: {', '.join(sorted(allowed))}",
            )
        return current_user

    return _checker
