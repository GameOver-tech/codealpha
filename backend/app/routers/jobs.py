"""Jobs endpoints — list active jobs (public) and create jobs (admin)."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.job import Job
from app.models.user import User
from app.repositories.interview_file import JobRepository
from app.schemas.jobs import JobCreate, JobOut

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

# Jobs are static configuration — cache the public list briefly to avoid a
# DB round-trip on every landing-page load. Invalidated on admin create.
_jobs_cache: tuple[float, list[Job]] | None = None
JOBS_CACHE_TTL_SECONDS = 60.0


@router.get("", response_model=list[JobOut])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    """Public — list all active jobs."""
    global _jobs_cache
    now = time.monotonic()
    if _jobs_cache is not None and now - _jobs_cache[0] < JOBS_CACHE_TTL_SECONDS:
        return _jobs_cache[1]
    repo = JobRepository(db)
    jobs = await repo.list_active()
    _jobs_cache = (now, jobs)
    return jobs


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only — create a new job posting."""
    global _jobs_cache
    repo = JobRepository(db)
    job = Job(title=payload.title, description=payload.description, created_by=current_user.id)
    await repo.add(job)
    await db.commit()
    await db.refresh(job)
    _jobs_cache = None  # invalidate the cached list
    return job
