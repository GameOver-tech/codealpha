"""Candidate profile endpoints — view, edit, upload profile picture."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile, status
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

    # Sync to Supabase Storage when configured.
    remote_path = rel_path
    if settings.SUPABASE_URL:
        try:
            from app.storage import copy_local_to_supabase

            remote_path = copy_local_to_supabase(storage.abs_path(rel_path), rel_path)
            storage.delete(rel_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Avatar sync to Supabase failed: %s", exc)

    repo = CandidateProfileRepository(db)
    profile = await repo.upsert(
        current_user.id, {"profile_picture_url": remote_path}
    )
    await db.commit()
    await db.refresh(profile)
    return profile
