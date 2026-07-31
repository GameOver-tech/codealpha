"""Jobs endpoints — list active jobs (public) and create jobs (admin)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.job import Job
from app.models.user import User
from app.repositories.interview_file import JobRepository
from app.schemas.jobs import JobCreate, JobOut

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


@router.get("", response_model=list[JobOut])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    """Public — list all active jobs."""
    repo = JobRepository(db)
    return await repo.list_active()


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only — create a new job posting."""
    repo = JobRepository(db)
    job = Job(title=payload.title, description=payload.description, created_by=current_user.id)
    await repo.add(job)
    await db.commit()
    await db.refresh(job)
    return job
