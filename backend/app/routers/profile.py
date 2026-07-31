"""Candidate profile endpoints — view, edit, upload profile picture."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.repositories.candidate_profile import CandidateProfileRepository
from app.repositories.user import UserRepository
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.storage.service import LocalStorage
from app.utils.exceptions import BadRequestError, NotFoundError

logger = get_logger(__name__)

router = APIRouter(prefix="/api/profile", tags=["Profile"])

MAX_PICTURE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_PICTURE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def resolve_picture_file(path: str):
    """Resolve a stored picture path to a local file if present."""
    if not path:
        return None
    # Local upload dir file (avatars/...)
    local = Path(settings.UPLOAD_DIR) / path
    if local.is_file():
        return local
    # Absolute path fallback
    direct = Path(path)
    if direct.is_file():
        return direct
    return None


async def _get_or_create_profile(db: AsyncSession, user: User):
    repo = CandidateProfileRepository(db)
    profile = await repo.get_by_user(user.id)
    if profile is None:
        profile = await repo.upsert(user.id, {})
        await db.commit()
        await db.refresh(profile)
    return profile


@router.get("", response_model=ProfileOut)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """View the candidate's profile (includes registration data)."""
    profile = await _get_or_create_profile(db, current_user)
    return profile


@router.put("", response_model=ProfileOut)
async def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit the candidate's profile (experience, skills, education, etc.)."""
    repo = CandidateProfileRepository(db)
    profile = await repo.get_by_user(current_user.id)
    if profile is None:
        raise NotFoundError("Profile not found — call GET /api/profile first")

    data = payload.model_dump()
    updated = await repo.upsert(current_user.id, data)
    await db.commit()
    await db.refresh(updated)
    return updated


@router.post("/picture", response_model=ProfileOut, status_code=status.HTTP_200_OK)
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a profile picture (JPEG/PNG/WebP, max 5MB)."""
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_PICTURE_TYPES:
        raise BadRequestError(
            f"Unsupported image type '{content_type}'. Allowed: JPEG, PNG, WebP."
        )

    storage = LocalStorage()
    rel_path, size = storage.save_upload(file, f"avatars/{current_user.id}")

    if size > MAX_PICTURE_BYTES:
        storage.delete(rel_path)
        raise BadRequestError("Profile picture must be 5MB or smaller")

    # Best-effort sync to Supabase Storage; the local copy is kept so the
    # picture is always servable via /api/profile/picture regardless of
    # storage connectivity.
    if settings.SUPABASE_URL:
        try:
            from app.storage import copy_local_to_supabase

            copy_local_to_supabase(storage.abs_path(rel_path), rel_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Avatar sync to Supabase failed: %s", exc)

    repo = CandidateProfileRepository(db)
    profile = await repo.upsert(
        current_user.id, {"profile_picture_url": rel_path}
    )
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/picture")
async def get_profile_picture(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve the authenticated user's profile picture.

    Resolves the stored path from local disk first, then falls back to a
    Supabase Storage signed URL. Returns 404 when no picture is set.
    """
    repo = CandidateProfileRepository(db)
    profile = await repo.get_by_user(current_user.id)
    if profile is None or not profile.profile_picture_url:
        raise NotFoundError("No profile picture uploaded")

    local = resolve_picture_file(profile.profile_picture_url)
    if local is not None:
        return FileResponse(str(local))

    # Fallback: signed URL from Supabase Storage.
    if settings.SUPABASE_URL:
        try:
            from app.storage.service import SupabaseStorage

            url = SupabaseStorage().signed_url(profile.profile_picture_url)
            if url:
                return RedirectResponse(url)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not build signed URL for avatar: %s", exc)

    raise NotFoundError("Profile picture file is not available")
