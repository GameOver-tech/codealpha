"""Authentication endpoints — register, login, logout, change password.

Auth is handled by Supabase Auth (email/password). The backend keeps a
``users`` row per authenticated user (id = our UUID, auth_uid = Supabase uid).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.supabase_client import get_supabase_anon, get_supabase_service
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UpdateMeRequest,
    UserOut,
)
from app.utils.exceptions import ConflictError, NotFoundError

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        role=user.role.value,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        phone=user.phone,
        gender=user.gender,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Auth"],
)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a candidate via Supabase Auth and create the local users row."""
    sb = get_supabase_service()

    # Unique email check against local users table (fast, deterministic).
    repo = UserRepository(db)
    if await repo.get_by_email(payload.email):
        raise ConflictError("An account with this email already exists")

    try:
        auth_resp = sb.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "full_name": f"{payload.first_name} {payload.last_name}".strip(),
                },
            }
        )
    except Exception as exc:  # noqa: BLE001
        err = str(exc).lower()
        if "already" in err or "duplicate" in err or "registered" in err:
            raise ConflictError("An account with this email already exists") from exc
        logger.exception("Supabase user creation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not create account: {exc}",
        ) from exc

    auth_user = auth_resp.user

    user = await repo.create_candidate(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        gender=payload.gender,
        password_hash=None,
        auth_uid=auth_user.id,
    )
    await db.commit()

    logger.info("Registered candidate %s (%s)", user.id, payload.email)

    # Issue a session token immediately so the frontend can proceed.
    try:
        session = sb.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
        return TokenResponse(
            access_token=session.session.access_token,
            expires_in=session.session.expires_in or 3600,
            refresh_token=session.session.refresh_token or "",
        )
    except Exception:  # noqa: BLE001
        # Account created but token exchange failed — login later works.
        return TokenResponse(access_token="", expires_in=0)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    """Authenticate with email/password via Supabase Auth and return a bearer token."""
    sb = get_supabase_anon()
    try:
        session = sb.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc

    if not session.user or not session.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return TokenResponse(
        access_token=session.session.access_token,
        expires_in=session.session.expires_in or 3600,
        refresh_token=session.session.refresh_token or "",
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest):
    """Exchange a Supabase refresh token for a fresh access token.

    The frontend calls this when an API request returns 401 so long-running
    sessions (e.g. interview processing) never force the admin to log back in.
    """
    sb = get_supabase_anon()
    try:
        session = sb.auth.refresh_session(payload.refresh_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc

    if not session.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    return TokenResponse(
        access_token=session.session.access_token,
        expires_in=session.session.expires_in or 3600,
        refresh_token=session.session.refresh_token or payload.refresh_token,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: User = Depends(get_current_user)):
    """Log out the current user.

    JWTs are stateless; the client discards the token. This endpoint exists
    so the flow is explicit and can be extended (e.g., token revocation).
    """
    logger.info("User %s logged out", current_user.id)
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's details."""
    return _user_out(current_user)


@router.put("/me", response_model=UserOut)
async def update_me(
    payload: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's personal details (name, phone, gender)."""
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return _user_out(current_user)

    repo = UserRepository(db)
    await repo.update(current_user.id, **updates)
    await db.commit()

    updated = await repo.get(current_user.id)
    logger.info("User %s updated profile", current_user.id)
    return _user_out(updated)


@router.put("/me/password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
):
    """Change the authenticated user's password (Supabase Auth)."""
    sb = get_supabase_anon()
    try:
        # Verify the current password first.
        sb.auth.sign_in_with_password(
            {"email": current_user.email, "password": payload.current_password}
        )
        sb.auth.update_user({"password": payload.new_password})
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        err = str(exc).lower()
        if "invalid" in err or "credentials" in err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            ) from exc
        logger.exception("Password change failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not update password: {exc}",
        ) from exc

    return MessageResponse(message="Password updated successfully")
